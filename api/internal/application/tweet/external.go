package tweet

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"golang.org/x/sync/singleflight"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	"blog-api/internal/middleware"
)

const externalPreviewTTL = 15 * time.Minute

type ExternalTweetDTO struct {
	ID              string `json:"id"`
	SourceID        string `json:"source_id"`
	CanonicalURL    string `json:"canonical_url"`
	SnapshotVersion string `json:"snapshot_version"`
	// Availability unavailable 不等于确定删除，只有明确证据才给出 deleted/private。
	Availability string `json:"availability"`
	// Snapshot 非 available 状态下为 nil，不返回旧正文和媒体。
	Snapshot    *domaintweet.ExternalSnapshot `json:"snapshot,omitempty"`
	QuotedTweet *ExternalTweetDTO             `json:"quoted_tweet,omitempty"`
}

type ExternalPreviewDTO struct {
	ExternalTweet ExternalTweetDTO `json:"external_tweet"`
	PreviewToken  string           `json:"preview_token"`
	ExpiresAt     time.Time        `json:"expires_at"`
	CanPublish    bool             `json:"can_publish"`
	Warnings      []string         `json:"warnings"`
}

type ExternalService struct {
	repo     domaintweet.ExternalRepository
	fetcher  ExternalFetcher
	media    ExternalMediaStore
	previews ExternalPreviewStore
	group    singleflight.Group
	slots    chan struct{}
	now      func() time.Time
}

func NewExternalService(repo domaintweet.ExternalRepository, fetcher ExternalFetcher, media ExternalMediaStore, previews ExternalPreviewStore) *ExternalService {
	return &ExternalService{repo: repo, fetcher: fetcher, media: media, previews: previews, slots: make(chan struct{}, 4), now: time.Now}
}

func (s *ExternalService) Preview(ctx context.Context, userID, rawURL string) (ExternalPreviewDTO, error) {
	if _, err := shared.ParseID(userID); err != nil {
		return ExternalPreviewDTO{}, shared.Unauthorized("请先登录")
	}
	sourceID, err := domaintweet.ParseXURL(rawURL)
	if err != nil {
		return ExternalPreviewDTO{}, err
	}
	ext, err := s.load(ctx, sourceID, false)
	if err != nil {
		return ExternalPreviewDTO{}, externalError(err)
	}
	if !ext.CanPublish() {
		return ExternalPreviewDTO{}, shared.NewError("EXTERNAL_UNAVAILABLE", "原文暂不可用，请重试或在 X 查看")
	}
	dtos, err := s.GetMany(ctx, []shared.ID{ext.ID})
	if err != nil {
		return ExternalPreviewDTO{}, err
	}
	dto := dtos[ext.ID.String()]
	if dto.Snapshot == nil || dto.Snapshot.Completeness != domaintweet.TextComplete {
		return ExternalPreviewDTO{}, shared.NewError("EXTERNAL_INCOMPLETE", "当前无法获取完整正文，请重试或在 X 查看")
	}
	ids := []shared.ID{ext.ID}
	binding := domaintweet.ExternalPreviewBinding{UserID: userID, ExternalID: ext.ID.String(), Version: dto.SnapshotVersion, ExpiresAt: s.now().Add(externalPreviewTTL)}
	if quote := dto.QuotedTweet; quote != nil {
		if quote.Snapshot != nil && quote.Snapshot.Completeness != domaintweet.TextComplete {
			return ExternalPreviewDTO{}, shared.NewError("EXTERNAL_INCOMPLETE", "当前无法获取完整的引用原文，请重试或在 X 查看")
		}
		binding.QuotedID, binding.QuotedVersion = quote.ID, quote.SnapshotVersion
		ids = append(ids, shared.MustParseID(quote.ID))
	}
	if err := s.repo.Protect(ctx, ids, binding.ExpiresAt); err != nil {
		return ExternalPreviewDTO{}, err
	}
	var random [32]byte
	if _, err := rand.Read(random[:]); err != nil {
		return ExternalPreviewDTO{}, shared.Internal("生成预览凭证失败", err)
	}
	token := hex.EncodeToString(random[:])
	if err := s.previews.Put(ctx, token, binding, externalPreviewTTL); err != nil {
		return ExternalPreviewDTO{}, shared.Internal("保存预览凭证失败", err)
	}
	warnings := append([]string{}, dto.Snapshot.Warnings...)
	for _, media := range dto.Snapshot.Media {
		if media.Kind != "photo" {
			warnings = append(warnings, "视频与 GIF 请在 X 查看")
			break
		}
	}
	return ExternalPreviewDTO{ExternalTweet: dto, PreviewToken: token, ExpiresAt: binding.ExpiresAt, CanPublish: true, Warnings: warnings}, nil
}

func (s *ExternalService) Binding(ctx context.Context, userID, token string) (*domaintweet.ExternalPreviewBinding, error) {
	if len(token) != 64 {
		return nil, shared.NewError("EXTERNAL_PREVIEW_EXPIRED", "预览凭证无效，请重新预览")
	}
	if _, err := hex.DecodeString(token); err != nil {
		return nil, shared.NewError("EXTERNAL_PREVIEW_EXPIRED", "预览凭证无效，请重新预览")
	}
	binding, err := s.previews.Get(ctx, token)
	if err != nil {
		return nil, err
	}
	if binding.UserID != userID {
		return nil, shared.Forbidden("不能使用其他用户的预览凭证")
	}
	if !s.now().Before(binding.ExpiresAt) {
		return nil, shared.NewError("EXTERNAL_PREVIEW_EXPIRED", "预览已过期，请重新预览后确认")
	}
	return binding, nil
}

func (s *ExternalService) load(ctx context.Context, sourceID string, force bool) (*domaintweet.ExternalTweet, error) {
	ch := s.group.DoChan(sourceID, func() (any, error) {
		workCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
		defer cancel()
		select {
		case s.slots <- struct{}{}:
		case <-workCtx.Done():
			return nil, &ExternalFetchError{Kind: "temporary"}
		}
		defer func() { <-s.slots }()
		ext, err := s.repo.Ensure(workCtx, sourceID, s.now().Add(30*time.Minute))
		if err != nil {
			return nil, err
		}
		if ext.TakenDown {
			return nil, &ExternalFetchError{Kind: "restricted", StopFallback: true}
		}
		needsQuote := ext.Snapshot != nil && ext.Snapshot.QuoteURL != "" && ext.QuotedID == nil
		if !force && ext.CanPublish() && !needsQuote && s.now().Sub(ext.FetchedAt) < time.Hour {
			return ext, nil
		}
		failure, err := s.previews.GetFailure(workCtx, sourceID)
		if err != nil {
			return nil, err
		}
		if failure != nil {
			return nil, failure
		}
		fetched, err := s.fetcher.Fetch(workCtx, sourceID)
		if err != nil {
			s.recordFailure(workCtx, ext, err)
			return nil, err
		}
		var total int64
		saved, err := s.saveFetched(workCtx, ext, fetched, &total)
		if err != nil {
			s.recordFailure(workCtx, ext, err)
			return nil, err
		}
		return saved, nil
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-ch:
		if result.Err != nil {
			return nil, result.Err
		}
		return result.Val.(*domaintweet.ExternalTweet), nil
	}
}

func (s *ExternalService) saveFetched(ctx context.Context, ext *domaintweet.ExternalTweet, fetched *ExternalFetchResult, total *int64) (*domaintweet.ExternalTweet, error) {
	if fetched.SourceID != ext.SourceID {
		return nil, &ExternalFetchError{Kind: "unavailable"}
	}
	if fetched.Availability != domaintweet.ExternalAvailable {
		if err := s.withdraw(ctx, ext.ID, fetched.Availability); err != nil {
			return nil, err
		}
		return s.repo.FindByID(ctx, ext.ID)
	}
	if fetched.Snapshot == nil || fetched.Snapshot.Completeness != domaintweet.TextComplete {
		return nil, &ExternalFetchError{Kind: "incomplete", StopFallback: true}
	}
	var quoteID *shared.ID
	if fetched.Quote == nil && fetched.Snapshot.QuoteURL != "" && ext.QuotedID != nil {
		// 嵌入引用只展开一层，不能覆盖该记录独立导入时已保存的引用关系。
		quote, err := s.repo.FindByID(ctx, *ext.QuotedID)
		if err != nil {
			return nil, err
		}
		if id, err := domaintweet.ParseXURL(fetched.Snapshot.QuoteURL); err == nil && id == quote.SourceID {
			quoteID = ext.QuotedID
		}
	}
	if fetched.Quote != nil && fetched.Quote.SourceID != fetched.SourceID {
		quote, err := s.repo.Ensure(ctx, fetched.Quote.SourceID, s.now().Add(30*time.Minute))
		if err != nil {
			return nil, err
		}
		if !quote.TakenDown {
			if _, err := s.saveFetched(ctx, quote, fetched.Quote, total); err != nil {
				return nil, err
			}
		}
		quoteID = &quote.ID
	}
	data, err := json.Marshal(struct {
		Snapshot *domaintweet.ExternalSnapshot
		QuoteID  *string
	}{Snapshot: fetched.Snapshot, QuoteID: idString(quoteID)})
	if err != nil {
		return nil, err
	}
	hash := sha256.Sum256(data)
	fingerprint := hex.EncodeToString(hash[:])
	expected := ext.Version
	prepared := false
	needsAvatar := ext.Snapshot != nil && ext.Snapshot.Author.AvatarURL == "" && fetched.Snapshot.Author.AvatarSourceURL != ""
	if ext.Fingerprint != fingerprint || !ext.CanPublish() || needsAvatar {
		ext.Version = uuid.NewString()
		if err := s.media.Prepare(ctx, ext.ID.String(), ext.Version, fetched.Snapshot, total); err != nil {
			return nil, &ExternalFetchError{Kind: "media_failed"}
		}
		prepared = true
		ext.Snapshot = fetched.Snapshot
	}
	ext.QuotedID, ext.Fingerprint = quoteID, fingerprint
	ext.CanonicalURL, ext.FetchSource, ext.Availability = fetched.CanonicalURL, fetched.FetchSource, domaintweet.ExternalAvailable
	ext.FetchedAt, ext.LastCheckedAt, ext.LastError = s.now(), s.now(), ""
	saved, err := s.repo.SaveSnapshot(ctx, ext, expected)
	if !saved && prepared {
		if cleanupErr := s.media.DeleteVersion(context.WithoutCancel(ctx), ext.ID.String(), ext.Version); cleanupErr != nil {
			log.Warn().Err(cleanupErr).Msg("清理未提交的 X 媒体失败")
		}
	}
	if err != nil {
		return nil, err
	}
	if !saved {
		return s.repo.FindByID(ctx, ext.ID)
	}
	return ext, nil
}

func idString(id *shared.ID) *string {
	if id == nil {
		return nil
	}
	value := id.String()
	return &value
}

func (s *ExternalService) recordFailure(ctx context.Context, ext *domaintweet.ExternalTweet, err error) {
	var failure *ExternalFetchError
	if !errors.As(err, &failure) {
		failure = &ExternalFetchError{Kind: "temporary"}
	}
	if failure.StopFallback && (failure.Kind == "deleted" || failure.Kind == "private" || failure.Kind == "restricted") {
		state := failure.Kind
		if state == "restricted" {
			state = domaintweet.ExternalUnavailable
		}
		if err := s.withdraw(ctx, ext.ID, state); err != nil {
			log.Warn().Err(err).Msg("撤回不可用 X 原文失败")
		}
	}
	if err := s.repo.RecordFailure(context.WithoutCancel(ctx), ext.ID, failure.Kind, s.now()); err != nil {
		log.Warn().Err(err).Msg("记录 X 原文检查失败")
	}
	if err := s.previews.PutFailure(context.WithoutCancel(ctx), ext.SourceID, failure, max(30*time.Second, failure.RetryAfter)); err != nil {
		log.Warn().Err(err).Msg("缓存 X 原文获取失败")
	}
}

func externalError(err error) error {
	var failure *ExternalFetchError
	if !errors.As(err, &failure) {
		return err
	}
	switch failure.Kind {
	case "incomplete":
		return shared.NewError("EXTERNAL_INCOMPLETE", "当前无法获取完整正文，请重试或在 X 查看")
	case "media_failed":
		return shared.NewError("EXTERNAL_MEDIA_FAILED", "原文图片准备失败，感想已保留，请重试")
	case "deleted":
		return shared.NewError("EXTERNAL_UNAVAILABLE", "原推文已删除")
	case "private":
		return shared.NewError("EXTERNAL_UNAVAILABLE", "原推文已转为私密")
	case "unavailable", "restricted":
		return shared.NewError("EXTERNAL_UNAVAILABLE", "原文暂不可用，请重试或在 X 查看")
	default:
		return shared.NewError("EXTERNAL_TEMPORARY", "数据源暂时无法访问，请稍后重试")
	}
}

func (s *ExternalService) GetMany(ctx context.Context, ids []shared.ID) (map[string]ExternalTweetDTO, error) {
	result := make(map[string]ExternalTweetDTO, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	rows, err := s.repo.FindByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	quotes := make([]shared.ID, 0, len(rows))
	seen := make(map[string]bool)
	for _, row := range rows {
		if row.QuotedID != nil && !seen[row.QuotedID.String()] {
			seen[row.QuotedID.String()] = true
			quotes = append(quotes, *row.QuotedID)
		}
	}
	quotedRows, err := s.repo.FindByIDs(ctx, quotes)
	if err != nil {
		return nil, err
	}
	quoted := make(map[string]ExternalTweetDTO, len(quotedRows))
	for _, row := range quotedRows {
		quoted[row.ID.String()] = externalDTO(row)
	}
	for _, row := range rows {
		dto := externalDTO(row)
		if row.QuotedID != nil {
			if quote, ok := quoted[row.QuotedID.String()]; ok {
				dto.QuotedTweet = &quote
			}
		}
		result[row.ID.String()] = dto
	}
	return result, nil
}

func externalDTO(ext *domaintweet.ExternalTweet) ExternalTweetDTO {
	dto := ExternalTweetDTO{ID: ext.ID.String(), SourceID: ext.SourceID, CanonicalURL: ext.CanonicalURL, SnapshotVersion: ext.Version, Availability: ext.Availability}
	if ext.Availability == domaintweet.ExternalAvailable && !ext.TakenDown {
		dto.Snapshot = ext.Snapshot
	}
	return dto
}

func (s *Service) externalViews(ctx context.Context, tweets []*domaintweet.Tweet, quoted map[string]*domaintweet.Tweet) map[string]ExternalTweetDTO {
	ids := make([]shared.ID, 0, len(tweets))
	seen := make(map[string]bool)
	add := func(t *domaintweet.Tweet) {
		if id := t.ExternalTweetID(); id != nil && !seen[id.String()] {
			ids = append(ids, *id)
			seen[id.String()] = true
		}
	}
	for _, t := range tweets {
		add(t)
	}
	for _, t := range quoted {
		add(t)
	}
	if s.external == nil || len(ids) == 0 {
		return nil
	}
	views, err := s.external.GetMany(ctx, ids)
	if err != nil {
		log.Warn().Err(err).Msg("批量查询 X 原文失败")
		return nil
	}
	return views
}

func sourceView(t *domaintweet.Tweet, views map[string]ExternalTweetDTO) *ExternalTweetDTO {
	id := t.ExternalTweetID()
	if id == nil {
		return nil
	}
	view, ok := views[id.String()]
	if !ok {
		view = ExternalTweetDTO{ID: id.String(), Availability: domaintweet.ExternalUnavailable}
	}
	return &view
}

func (s *ExternalService) withdraw(ctx context.Context, id shared.ID, availability string) error {
	if err := s.repo.Withdraw(ctx, id, availability, s.now()); err != nil {
		return err
	}
	if err := s.media.DeleteAll(ctx, id.String()); err != nil {
		return shared.Internal("原文已下架，媒体清理失败，请重试", err)
	}
	return nil
}

func (s *Service) PreviewExternal(ctx context.Context, userID, url string) (ExternalPreviewDTO, error) {
	if s.external == nil {
		return ExternalPreviewDTO{}, shared.Internal("X 转发服务未启用", nil)
	}
	return s.external.Preview(ctx, userID, url)
}

func (s *Service) WithdrawExternal(ctx context.Context, id string) error {
	if !s.canManageExternal(ctx) {
		return shared.Forbidden("无权下架共享原文")
	}
	idValue, err := shared.ParseID(id)
	if err != nil {
		return shared.BadRequest("非法的原文 ID")
	}
	if _, err := s.external.repo.FindByID(ctx, idValue); err != nil {
		return err
	}
	return s.external.withdraw(ctx, idValue, domaintweet.ExternalUnavailable)
}

func (s *Service) RefreshExternal(ctx context.Context, id string) (ExternalTweetDTO, error) {
	if !s.canManageExternal(ctx) {
		return ExternalTweetDTO{}, shared.Forbidden("无权刷新共享原文")
	}
	idValue, err := shared.ParseID(id)
	if err != nil {
		return ExternalTweetDTO{}, shared.BadRequest("非法的原文 ID")
	}
	ext, err := s.external.repo.FindByID(ctx, idValue)
	if err != nil {
		return ExternalTweetDTO{}, err
	}
	if _, err := s.external.load(ctx, ext.SourceID, true); err != nil {
		return ExternalTweetDTO{}, externalError(err)
	}
	dtos, err := s.external.GetMany(ctx, []shared.ID{idValue})
	return dtos[id], err
}

func (s *Service) canManageExternal(ctx context.Context) bool {
	return s.external != nil && (middleware.GetUserIsRoot(ctx) || (s.perm != nil && s.perm.HasPermission(middleware.GetUserRole(ctx), false, PermDeleteAny)))
}

// Maintain 每轮最多检查 50 条到期原文，并保留失效来源的本站讨论。
func (s *ExternalService) Maintain(ctx context.Context) (checked, failed, cleaned int, err error) {
	due, err := s.repo.FindDue(ctx, s.now().Add(-24*time.Hour), 50)
	if err != nil {
		return 0, 0, 0, err
	}
	for _, ext := range due {
		if ctx.Err() != nil {
			return checked, failed, cleaned, ctx.Err()
		}
		checked++
		if _, err := s.load(ctx, ext.SourceID, true); err != nil {
			failed++
		}
	}
	before := s.now().Add(-24 * time.Hour)
	unused, err := s.repo.FindUnused(ctx, before, 100)
	if err != nil {
		return checked, failed, cleaned, err
	}
	for _, ext := range unused {
		deleted, err := s.repo.DeleteUnused(ctx, ext.ID, before)
		if err != nil {
			return checked, failed, cleaned, err
		}
		if deleted {
			if err := s.media.DeleteAll(ctx, ext.ID.String()); err != nil {
				return checked, failed, cleaned, err
			}
			cleaned++
		}
	}
	versions, err := s.repo.AssetVersions(ctx)
	if err != nil {
		return checked, failed, cleaned, err
	}
	err = s.media.Sweep(ctx, versions, before)
	return checked, failed, cleaned, err
}
