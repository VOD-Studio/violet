package music

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

type Service struct {
	repo     music.Repository
	provider Provider
	box      CredentialBox
	// featuredIDs 缓存启用展示歌单的曲目 ID 集合，featuredExpiry 前有效；
	// 用于把站点账号解析范围限制在展示曲目内。
	featuredMu     sync.Mutex
	featuredIDs    map[string]struct{}
	featuredExpiry time.Time
	// playbackCache 缓存最近成功解析的播放地址（含试听标记），playbackCacheGen 是
	// 产出缓存的凭据版本；连接、退出或续期推进版本即整体失效。匿名解析同样缓存。
	playbackMu       sync.Mutex
	playbackCache    map[string]playbackEntry
	playbackCacheGen int64
	// playbackInflight 让同曲并发解析收敛为一次上游请求（singleflight）。
	playbackInflight map[string]chan struct{}
}

type playbackEntry struct {
	value  music.SongURL
	expiry time.Time
}

func NewService(repo music.Repository, provider Provider, box CredentialBox) *Service {
	return &Service{repo: repo, provider: provider, box: box}
}

type Status struct {
	Configured             bool   `json:"configured"`
	CredentialStorageReady bool   `json:"credential_storage_ready"`
	BaseURL                string `json:"base_url"`
}
type Verification struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message"`
}
type ChallengeDTO struct {
	// ID 是本站一次性挑战标识，不是网易云二维码 key。
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}
type CheckDTO struct {
	// State 为 waiting、scanned、confirmed 或 expired。
	State string `json:"state"`
	// Account 仅在本次确认成功时非空。
	Account *music.Account `json:"account"`
}

func (s *Service) Status() Status {
	return Status{s.provider.Configured(), s.box != nil, s.provider.BaseURL()}
}
func (s *Service) Verify(ctx context.Context) Verification {
	if err := s.provider.Verify(ctx); err != nil {
		return Verification{false, safeProviderError(err).Error()}
	}
	return Verification{true, "Kite 连接与服务令牌验证成功"}
}
func safeProviderError(err error) error {
	if err == nil {
		return nil
	}
	var pe *ProviderError
	if errors.As(err, &pe) {
		if pe.Reason == "LOGIN_REQUIRED" {
			return shared.BadRequest(pe.Message)
		}
		return shared.Internal(pe.Message, pe)
	}
	return shared.Internal("音乐服务暂时不可用", nil)
}
func loginRequired(err error) bool {
	var pe *ProviderError
	return errors.As(err, &pe) && pe.Reason == "LOGIN_REQUIRED"
}
func (s *Service) ready() error {
	if !s.provider.Configured() {
		return shared.BadRequest("尚未配置 Kite 音乐服务")
	}
	if s.box == nil {
		return shared.BadRequest("音乐凭据加密密钥未配置或不足 32 字节")
	}
	return nil
}
func (s *Service) open(c music.Credential) (string, error) {
	if s.box == nil {
		return "", shared.BadRequest("音乐凭据加密不可用，请检查 MUSIC_CREDENTIAL_KEY")
	}
	cookie, err := s.box.Open(c.SealedCookie)
	if err != nil {
		return "", shared.BadRequest("音乐凭据无法解密，请退出后重新扫码")
	}
	return cookie, nil
}
func disconnected() music.Account { return music.Account{State: "disconnected"} }
func (s *Service) Account(ctx context.Context) (music.Account, error) {
	if !s.provider.Configured() {
		return disconnected(), nil
	}
	c, err := s.repo.Credential(ctx)
	if err != nil {
		return music.Account{}, err
	}
	if c.SealedCookie == "" {
		return disconnected(), nil
	}
	if c.Expired {
		return music.Account{State: "expired", Profile: &c.Profile}, nil
	}
	cookie, err := s.open(c)
	if err != nil {
		return music.Account{}, err
	}
	session, err := s.provider.Account(ctx, cookie)
	if loginRequired(err) || err == nil && session == nil {
		return music.Account{State: "expired", Profile: &c.Profile}, nil
	}
	if err != nil {
		return music.Account{}, safeProviderError(err)
	}
	return music.Account{State: "connected", Profile: &session.Profile}, nil
}
func (s *Service) LoginQR(ctx context.Context, owner string) (ChallengeDTO, error) {
	if err := s.ready(); err != nil {
		return ChallengeDTO{}, err
	}
	c, err := s.repo.Credential(ctx)
	if err != nil {
		return ChallengeDTO{}, err
	}
	qr, err := s.provider.LoginQR(ctx)
	if err != nil {
		return ChallengeDTO{}, safeProviderError(err)
	}
	challenge := music.Challenge{ID: uuid.NewString(), OwnerID: owner, Key: qr.Key, Generation: c.Generation, ExpiresAt: time.Now().UTC().Add(3 * time.Minute)}
	if err := s.repo.CreateChallenge(ctx, challenge); err != nil {
		return ChallengeDTO{}, err
	}
	return ChallengeDTO{challenge.ID, qr.URL, challenge.ExpiresAt}, nil
}
func (s *Service) CheckQR(ctx context.Context, id, owner string) (CheckDTO, error) {
	if err := s.ready(); err != nil {
		return CheckDTO{}, err
	}
	c, err := s.repo.FindChallenge(ctx, id, owner)
	if err != nil {
		return CheckDTO{}, err
	}
	if c == nil {
		return CheckDTO{State: "expired"}, nil
	}
	result, err := s.provider.CheckQR(ctx, c.Key)
	if err != nil {
		return CheckDTO{}, safeProviderError(err)
	}
	if result.State == "expired" {
		return CheckDTO{State: "expired"}, s.repo.CancelChallenge(ctx, id, owner)
	}
	if result.State != "confirmed" {
		return CheckDTO{State: result.State}, nil
	}
	if result.Session == nil || result.Session.Cookie == "" {
		return CheckDTO{}, shared.Internal("音乐服务未返回登录凭据", nil)
	}
	if err := music.ValidateID(result.Session.Profile.ID); err != nil {
		return CheckDTO{}, shared.Internal("音乐服务返回无效账号", nil)
	}
	sealed, err := s.box.Seal(result.Session.Cookie)
	if err != nil {
		return CheckDTO{}, shared.Internal("音乐凭据加密失败", nil)
	}
	saved, err := s.repo.ConfirmChallenge(ctx, *c, music.Credential{SealedCookie: sealed, Profile: result.Session.Profile})
	if err != nil {
		return CheckDTO{}, err
	}
	if !saved {
		return CheckDTO{State: "expired"}, nil
	}
	return CheckDTO{State: "confirmed", Account: &music.Account{State: "connected", Profile: &result.Session.Profile}}, nil
}
func (s *Service) CancelQR(ctx context.Context, id, owner string) error {
	return s.repo.CancelChallenge(ctx, id, owner)
}

// RefreshIfConnected 供每日任务调用；未配置、未保存账号或已确认失效时不请求上游。
func (s *Service) RefreshIfConnected(ctx context.Context) error {
	if !s.provider.Configured() || s.box == nil {
		return nil
	}
	c, err := s.repo.Credential(ctx)
	if err != nil {
		return err
	}
	if c.SealedCookie == "" || c.Expired {
		return nil
	}
	_, err = s.refreshCredential(ctx, c)
	return err
}

func (s *Service) Refresh(ctx context.Context) (music.Account, error) {
	if err := s.ready(); err != nil {
		return music.Account{}, err
	}
	c, err := s.repo.Credential(ctx)
	if err != nil {
		return music.Account{}, err
	}
	if c.SealedCookie == "" {
		return music.Account{}, shared.BadRequest("尚未连接网易云账号")
	}
	return s.refreshCredential(ctx, c)
}

func (s *Service) refreshCredential(ctx context.Context, c music.Credential) (music.Account, error) {
	cookie, err := s.open(c)
	if err != nil {
		return music.Account{}, err
	}
	fresh, err := s.provider.Refresh(ctx, cookie)
	if err != nil {
		if loginRequired(err) {
			if saveErr := s.expireCredential(ctx, c); saveErr != nil {
				return music.Account{}, saveErr
			}
		}
		return music.Account{}, safeProviderError(err)
	}
	if fresh == "" {
		return music.Account{}, shared.Internal("音乐服务未返回续期凭据", nil)
	}
	// 上游可能已轮换 Cookie，后续状态查询失败也不能丢弃新凭据。
	sealed, err := s.box.Seal(fresh)
	if err != nil {
		return music.Account{}, shared.Internal("音乐凭据加密失败", nil)
	}
	saved, err := s.repo.ReplaceCredential(ctx, c.Generation, music.Credential{SealedCookie: sealed, Profile: c.Profile})
	if err != nil {
		return music.Account{}, err
	}
	if !saved {
		return music.Account{}, shared.Conflict("账号已发生变更，请刷新状态")
	}
	session, err := s.provider.Account(ctx, fresh)
	if loginRequired(err) || err == nil && session == nil {
		c.Generation++
		c.SealedCookie = sealed
		c.Expired = false
		if saveErr := s.expireCredential(ctx, c); saveErr != nil {
			return music.Account{}, saveErr
		}
		return music.Account{}, shared.BadRequest("网易云账号已过期，请重新扫码")
	}
	if err != nil {
		return music.Account{}, safeProviderError(err)
	}
	return music.Account{State: "connected", Profile: &session.Profile}, nil
}

func (s *Service) expireCredential(ctx context.Context, c music.Credential) error {
	if c.Expired {
		return nil
	}
	c.Expired = true
	saved, err := s.repo.ReplaceCredential(ctx, c.Generation, c)
	if err != nil {
		return err
	}
	if !saved {
		return shared.Conflict("账号已发生变更，请刷新状态")
	}
	return nil
}

func (s *Service) Logout(ctx context.Context) error {
	// 先原子清除本地连接并推进版本；任何在途续期/扫码结果都不能复活它。
	c, err := s.repo.ClearCredential(ctx)
	if err != nil {
		return err
	}
	if c.SealedCookie == "" {
		return nil
	}
	cookie, err := s.open(c)
	if err != nil {
		return shared.BadRequest("本站连接已清除；旧凭据无法解密，未能撤销网易云会话")
	}
	if err := s.provider.Logout(ctx, cookie); err != nil {
		return shared.BadRequest("本站连接已清除；网易云会话撤销失败，请在网易云客户端检查登录设备")
	}
	return nil
}
