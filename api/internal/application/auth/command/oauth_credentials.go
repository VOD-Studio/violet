package command

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"


	"blog-api/internal/brand"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

// OAuthCredentialsRepository OAuth 凭据的持久化端口（DB 单行表，admin 权限域）。
// secret 不进 site_settings（公开可读域）；本端口对应的表只经 admin 端点读写，
// 与 env 密钥同一信任域。
type OAuthCredentialsRepository interface {
	// Load 读取凭据行；从未保存过时返回零值
	Load(ctx context.Context) (OAuthCredentialsRecord, error)
	// Save 整行 upsert（空串=显式清空该字段）
	Save(ctx context.Context, rec OAuthCredentialsRecord) error
}

// OAuthCredentialsRecord 凭据字段载体
type OAuthCredentialsRecord struct {
	GoogleClientID     string
	GithubClientID     string
	GithubClientSecret string
}

// OAuthCredentials OAuth 凭据的运行时存储。
//
// 启动时以 env 为初值，再从 DB 载入后台保存过的字段覆盖（DB 为最新）；
// 后台保存 = 内存 + DB 同步落库，DB 失败即整体失败并回滚内存，
// 不存在「已生效但未持久化」的中间态。
type OAuthCredentials struct {
	mu             sync.RWMutex
	googleClientID string
	githubClientID string
	githubSecret   string
	repo           OAuthCredentialsRepository
}

// NewOAuthCredentials 构造；repo 为持久化端口，Bootstrap 前仅用 env 初值
func NewOAuthCredentials(googleClientID, githubClientID, githubClientSecret string, repo OAuthCredentialsRepository) *OAuthCredentials {
	return &OAuthCredentials{
		googleClientID: googleClientID,
		githubClientID: githubClientID,
		githubSecret:   githubClientSecret,
		repo:           repo,
	}
}

// Bootstrap 启动时从 DB 载入：非空字段覆盖 env 初值（后台保存过的以 DB 为准）。
// DB 不可达时保留 env 初值并记录错误——登录用 env 凭据仍可用，后台保存会显式失败。
func (c *OAuthCredentials) Bootstrap(ctx context.Context) error {
	rec, err := c.repo.Load(ctx)
	if err != nil {
		return err
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if rec.GoogleClientID != "" {
		c.googleClientID = rec.GoogleClientID
	}
	if rec.GithubClientID != "" {
		c.githubClientID = rec.GithubClientID
	}
	if rec.GithubClientSecret != "" {
		c.githubSecret = rec.GithubClientSecret
	}
	return nil
}
func (c *OAuthCredentials) GoogleClientID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.googleClientID
}

// GithubClientID 当前生效的 GitHub client_id
func (c *OAuthCredentials) GithubClientID() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.githubClientID
}

// GithubClientSecret 当前生效的 GitHub client_secret
func (c *OAuthCredentials) GithubClientSecret() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.githubSecret
}

// OAuthCredentialUpdate OAuth 凭据写入入参（指针表部分更新，nil 不更新）
type OAuthCredentialUpdate struct {
	GoogleClientID     *string
	GithubClientID     *string
	GithubClientSecret *string
}

// Update 保存凭据：内存 + DB 同步落库。
//
// 先在内存求出新值并写入 DB，成功后提交内存；DB 失败则回滚内存到旧值，
// 返回错误——不存在「已生效但未持久化」的中间态。
func (c *OAuthCredentials) Update(ctx context.Context, in OAuthCredentialUpdate) error {
	c.mu.Lock()
	oldGoogle, oldGithubID, oldGithubSecret := c.googleClientID, c.githubClientID, c.githubSecret
	if in.GoogleClientID != nil {
		c.googleClientID = strings.TrimSpace(*in.GoogleClientID)
	}
	if in.GithubClientID != nil {
		c.githubClientID = strings.TrimSpace(*in.GithubClientID)
	}
	if in.GithubClientSecret != nil {
		c.githubSecret = strings.TrimSpace(*in.GithubClientSecret)
	}
	next := OAuthCredentialsRecord{
		GoogleClientID: c.googleClientID, GithubClientID: c.githubClientID, GithubClientSecret: c.githubSecret,
	}
	c.mu.Unlock()

	if err := c.repo.Save(ctx, next); err != nil {
		c.mu.Lock()
		c.googleClientID, c.githubClientID, c.githubSecret = oldGoogle, oldGithubID, oldGithubSecret
		c.mu.Unlock()
		return shared.Internal("OAuth 凭据保存失败", err)
	}
	return nil
}

// ProviderStatus 单个 provider 的凭据状态
type ProviderStatus struct {
	// Configured 凭据是否齐全（登录链路可用）
	Configured bool `json:"configured"`
	// ClientIDPreview client_id 脱敏预览（公开值，仅截断展示；secret 绝不外泄）
	ClientIDPreview string `json:"client_id_preview"`
	// Issue 不可用原因（空串=正常）
	Issue string `json:"issue"`
}

// OAuthStatusOutput 凭据状态查询输出
type OAuthStatusOutput struct {
	Google ProviderStatus `json:"google"`
	Github ProviderStatus `json:"github"`
}

// Status 检测两个 provider 的凭据配置状态。
// Google 只需 client_id（ID token 校验方向）；GitHub 需 id + secret 成对。
func (c *OAuthCredentials) Status() OAuthStatusOutput {
	c.mu.RLock()
	defer c.mu.RUnlock()

	g := ProviderStatus{ClientIDPreview: preview(c.googleClientID)}
	switch {
	case c.googleClientID == "":
		g.Issue = "未配置 client_id"
	case !strings.HasSuffix(c.googleClientID, ".apps.googleusercontent.com"):
		g.Issue = "client_id 格式异常（应以 .apps.googleusercontent.com 结尾）"
	default:
		g.Configured = true
	}

	gh := ProviderStatus{ClientIDPreview: preview(c.githubClientID)}
	switch {
	case c.githubClientID == "" && c.githubSecret == "":
		gh.Issue = "未配置 client_id 与 client_secret"
	case c.githubClientID == "":
		gh.Issue = "未配置 client_id"
	case c.githubSecret == "":
		gh.Issue = "未配置 client_secret"
	default:
		gh.Configured = true
	}

	return OAuthStatusOutput{Google: g, Github: gh}
}

// preview 脱敏预览：保留前 8 后 6 字符，过短则全掩码
func preview(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 14 {
		return s[:2] + "****"
	}
	return s[:8] + "..." + s[len(s)-6:]
}


// VerifyResult 单 provider 凭据有效性探测结果
type VerifyResult struct {
	// Valid 凭据在 provider 侧有效（token 端点确认 client 存在且 secret 匹配）
	Valid bool `json:"valid"`
	// Detail 探测详情（有效时给确认语，无效时给 provider 侧原因）
	Detail string `json:"detail"`
}

// verifyProbeCode 探测用的一次性 code：永远无效，仅用于把 provider 推进到
// 凭据校验环节——OAuth 无公开的 client 查询端点（防枚举），token 端点的
// 错误码是唯一可程序化区分「凭据被删/被改」与「code 无效」的信号。
const verifyProbeCode = "violet-oauth-verify-probe"

// VerifyProvider 探测 provider 侧凭据有效性（手动触发，勿自动轮询——
// 高频探测会被 provider 限流）。
//
// 判读矩阵（token 端点对假 code 的响应）：
//
//	GitHub: 404 → App 已删；incorrect_client_credentials → secret 错；
//	        bad_verification_code → 凭据有效
//	Google: invalid_client → client 已删；其余（invalid_request 等）→ 存在
func (c *OAuthCredentials) VerifyProvider(ctx context.Context, provider string) (VerifyResult, error) {
	switch provider {
	case "google":
		return c.verifyGoogle(ctx)
	case "github":
		return c.verifyGithub(ctx)
	default:
		return VerifyResult{}, shared.BadRequest("未知 provider: " + provider)
	}
}

func (c *OAuthCredentials) verifyGoogle(ctx context.Context) (VerifyResult, error) {
	id := c.GoogleClientID()
	if id == "" {
		return VerifyResult{}, domainsettings.ErrOAuthNotConfigured
	}
	form := url.Values{
		"client_id":  {id},
		"grant_type": {"authorization_code"},
		"code":       {verifyProbeCode},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://oauth2.googleapis.com/token", strings.NewReader(form.Encode()))
	if err != nil {
		return VerifyResult{}, shared.Internal("构建 Google 探测请求失败", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return VerifyResult{}, shared.Internal("Google 探测请求失败（检查服务器出网/代理）", err)
	}
	defer resp.Body.Close()

	var body struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)

	// invalid_client → App 已删；其余错误（invalid_request 缺 secret 校验 /
	// invalid_grant 假 code）都说明走过了 client 存在性检查
	if body.Error == "invalid_client" {
		return VerifyResult{Valid: false, Detail: "Google 侧不存在此 client_id（App 可能已删除）: " + body.ErrorDescription}, nil
	}
	return VerifyResult{Valid: true, Detail: "client_id 在 Google 侧有效"}, nil
}

func (c *OAuthCredentials) verifyGithub(ctx context.Context) (VerifyResult, error) {
	id, secret := c.GithubClientID(), c.GithubClientSecret()
	if id == "" || secret == "" {
		return VerifyResult{}, domainsettings.ErrOAuthNotConfigured
	}
	form := url.Values{
		"client_id":     {id},
		"client_secret": {secret},
		"code":          {verifyProbeCode},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return VerifyResult{}, shared.Internal("构建 GitHub 探测请求失败", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", brand.GitHubOAuthUA)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return VerifyResult{}, shared.Internal("GitHub 探测请求失败（检查服务器出网/代理）", err)
	}
	defer resp.Body.Close()

	var body struct {
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return VerifyResult{Valid: false, Detail: "GitHub 侧不存在此 client_id（OAuth App 可能已删除）"}, nil
	case body.Error == "incorrect_client_credentials":
		return VerifyResult{Valid: false, Detail: "client_secret 与 GitHub 侧不匹配（可能已被重置）"}, nil
	case body.Error == "bad_verification_code":
		// 走到了 code 校验环节：id 与 secret 均被 GitHub 接受
		return VerifyResult{Valid: true, Detail: "凭据在 GitHub 侧有效"}, nil
	case body.Error != "":
		return VerifyResult{Valid: false, Detail: body.Error + ": " + body.ErrorDescription}, nil
	default:
		return VerifyResult{}, shared.Internal("GitHub 探测返回未预期的成功响应", errors.New("probe code accepted"))
	}
}
