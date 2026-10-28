// Package linkpreview 提供链接卡片应用用例：批量查询、惰性刷新与发布时登记。
//
// 读取永不等网络：Lookup 返回当前缓存快照，miss / TTL 过期 / 失败退避已过的
// URL 触发后台异步重抓（singleflight 合并同 URL、信号量限进程并发），
// 结果在下次读取时生效。
package linkpreview

import (
	"context"
	"net/url"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/sync/singleflight"

	domainlink "blog-api/internal/domain/linkpreview"
	"blog-api/internal/domain/shared"
)

const (
	// MaxLookupURLs 单次 Lookup 的 URL 数上限（HTTP 端点与推文 DTO 组装共用）。
	MaxLookupURLs = 10
	// FetchBudget 单个卡片"页面抓取 + 封面下载"的总时长预算。
	FetchBudget = 30 * time.Second
)

// PageFetcher 页面元数据抓取端口（infrastructure/linkpreview 实现）。
type PageFetcher interface {
	Fetch(ctx context.Context, rawURL string) (FetchResult, error)
}

// CoverSaver 封面落盘端口（infrastructure/linkpreview 实现）。
type CoverSaver interface {
	Save(ctx context.Context, pageURL, srcURL string) (string, error)
}

// Service 链接卡片应用服务。
type Service struct {
	repo    domainlink.LinkCardRepository
	fetcher PageFetcher
	covers  CoverSaver
	newID   func() shared.ID
	sf      singleflight.Group
	sem     chan struct{}
	now     func() time.Time
	ttl     time.Duration
}

// ServiceOption Service 的可选配置（测试注入时钟等）。
type ServiceOption func(*Service)

// WithClock 注入时钟（测试）。
func WithClock(now func() time.Time) ServiceOption {
	return func(s *Service) { s.now = now }
}

// NewService 构造服务。fetchConcurrency 为进程内抓取并发上限。
func NewService(
	repo domainlink.LinkCardRepository,
	fetcher PageFetcher,
	covers CoverSaver,
	fetchConcurrency int,
	opts ...ServiceOption,
) *Service {
	if fetchConcurrency <= 0 {
		fetchConcurrency = 4
	}
	s := &Service{
		repo: repo, fetcher: fetcher, covers: covers,
		newID: shared.NewID,
		sem:   make(chan struct{}, fetchConcurrency),
		now:   time.Now,
		ttl:   domainlink.DefaultTTL,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Lookup 批量取卡片：返回"当前可展示"的卡片，key 为规范化 URL。
//
// 不可展示（miss / 从未成功）的 URL 不出现在返回 map 中；
// 需要刷新的 URL 异步重抓，不阻塞本次响应。
func (s *Service) Lookup(ctx context.Context, urls []string) map[string]*LinkCardDTO {
	now := s.now()
	normalized := domainlink.NormalizeURLs(urls)
	if len(normalized) > MaxLookupURLs {
		normalized = normalized[:MaxLookupURLs]
	}
	existing := map[string]*domainlink.LinkCard{}
	if rows, err := s.repo.FindByURLs(ctx, normalized); err == nil {
		for _, card := range rows {
			existing[card.URL()] = card
		}
	} else {
		log.Error().Err(err).Msg("linkpreview: 查询卡片缓存失败")
	}

	result := make(map[string]*LinkCardDTO, len(normalized))
	for _, u := range normalized {
		card, ok := existing[u]
		if ok && card.Displayable() {
			result[u] = toDTO(card)
		}
		if !ok || card.NeedRefresh(now) {
			go s.refresh(u, card)
		}
	}
	return result
}

// Register 发布时登记正文 URL：语义与 Lookup 相同（miss 即后台首抓，幂等）。
func (s *Service) Register(ctx context.Context, urls []string) {
	s.Lookup(ctx, urls)
}

// refresh 单个 URL 的后台重抓：singleflight 合并并发，信号量限并发，
// 成功写快照（封面失败降级纯文本卡），失败记退避。
func (s *Service) refresh(rawURL string, existing *domainlink.LinkCard) {
	_, _, _ = s.sf.Do(rawURL, func() (any, error) {
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		ctx, cancel := context.WithTimeout(context.Background(), FetchBudget)
		defer cancel()
		saveCtx := context.WithoutCancel(ctx)
		now := s.now()

		card := existing
		if card == nil {
			var err error
			card, err = domainlink.NewLinkCard(s.newID(), rawURL, now)
			if err != nil {
				return nil, err
			}
		}

		meta, err := s.fetcher.Fetch(ctx, rawURL)
		if err != nil {
			card.RecordFailure(err.Error(), now)
			if saveErr := s.repo.Save(saveCtx, card); saveErr != nil {
				log.Error().Err(saveErr).Str("url", rawURL).Msg("linkpreview: 保存失败卡片出错")
			}
			return nil, err
		}

		imageURL := ""
		if src := absoluteImage(rawURL, meta.ImageURL); src != "" {
			// 封面失败不阻塞卡片：降级纯文本卡。
			if local, coverErr := s.covers.Save(ctx, rawURL, src); coverErr == nil {
				imageURL = local
			} else {
				log.Debug().Err(coverErr).Str("url", rawURL).Msg("linkpreview: 封面下载降级")
			}
		}
		card.RecordSuccess(meta.Title, meta.Description, meta.SiteName, imageURL, now, s.ttl)
		if saveErr := s.repo.Save(saveCtx, card); saveErr != nil {
			log.Error().Err(saveErr).Str("url", rawURL).Msg("linkpreview: 保存卡片出错")
		}
		return nil, nil
	})
}

// absoluteImage 相对封面地址 → 绝对地址；无效或仍无主机时返回空串。
func absoluteImage(pageURL, raw string) string {
	base, err := url.Parse(pageURL)
	if err != nil || raw == "" {
		return ""
	}
	ref, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	abs := base.ResolveReference(ref)
	if abs.Scheme != "http" && abs.Scheme != "https" || abs.Host == "" {
		return ""
	}
	return abs.String()
}
