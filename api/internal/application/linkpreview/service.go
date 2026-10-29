// Package linkpreview 编排共享链接预览的缓存查询与按需刷新。
package linkpreview

import (
	"context"
	"net/url"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	domainlink "blog-api/internal/domain/linkpreview"
	"blog-api/internal/domain/shared"
)

const (
	MaxLookupURLs = 10
	FetchBudget   = 30 * time.Second
)

type PageFetcher interface {
	Fetch(ctx context.Context, rawURL string) (FetchResult, error)
}

type CoverSaver interface {
	Save(ctx context.Context, pageURL, srcURL string) (string, error)
}

type Service struct {
	repo        domainlink.LinkCardRepository
	fetcher     PageFetcher
	covers      CoverSaver
	ctx         context.Context
	mu          sync.Mutex
	active      map[string]struct{}
	concurrency int
}

// NewService 的 ctx 管理后台抓取生命周期；读取请求取消不取消其他读者共享的抓取。
func NewService(ctx context.Context, repo domainlink.LinkCardRepository, fetcher PageFetcher, covers CoverSaver, concurrency int) *Service {
	return &Service{
		repo: repo, fetcher: fetcher, covers: covers, ctx: ctx,
		active: make(map[string]struct{}), concurrency: max(1, concurrency),
	}
}

// Lookup 不等待上游网络；pending 区分尚未完成的抓取与 unavailable 终态。
func (s *Service) Lookup(ctx context.Context, urls []string) (LookupResultDTO, error) {
	result := LookupResultDTO{
		Cards: make(map[string]*LinkCardDTO), Pending: []string{}, Unavailable: []string{},
	}
	normalized := domainlink.NormalizeURLs(urls)
	if len(normalized) == 0 {
		return result, nil
	}
	rows, err := s.repo.FindByURLs(ctx, normalized)
	if err != nil {
		return result, err
	}
	existing := make(map[string]*domainlink.LinkCard, len(rows))
	for _, card := range rows {
		existing[card.URL()] = card
	}
	now := time.Now()
	for _, u := range normalized {
		card := existing[u]
		if card != nil && card.Displayable() {
			result.Cards[u] = toDTO(card)
		}
		if card == nil || card.NeedRefresh(now) {
			result.Pending = append(result.Pending, u)
			s.schedule(u)
		} else if !card.Displayable() {
			result.Unavailable = append(result.Unavailable, u)
		}
	}
	return result, nil
}

// Register 在发布后提前准备预览，失败不影响已提交的推文。
func (s *Service) Register(ctx context.Context, urls []string) {
	if _, err := s.Lookup(ctx, urls); err != nil {
		log.Warn().Err(err).Msg("链接预览登记失败")
	}
}

func (s *Service) schedule(u string) {
	s.mu.Lock()
	if _, running := s.active[u]; running || len(s.active) >= s.concurrency || s.ctx.Err() != nil {
		s.mu.Unlock()
		return
	}
	s.active[u] = struct{}{}
	s.mu.Unlock()
	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.active, u)
			s.mu.Unlock()
		}()
		ctx, cancel := context.WithTimeout(s.ctx, FetchBudget)
		defer cancel()
		if err := s.refresh(ctx, u); err != nil {
			log.Debug().Err(err).Msg("链接预览抓取未完成")
		}
	}()
}

func (s *Service) refresh(ctx context.Context, u string) error {
	// 准入后重读，避免使用请求早先拿到的过期快照覆盖已完成的刷新。
	rows, err := s.repo.FindByURLs(ctx, []string{u})
	if err != nil {
		return err
	}
	now := time.Now()
	var card *domainlink.LinkCard
	if len(rows) > 0 {
		card = rows[0]
		if !card.NeedRefresh(now) {
			return nil
		}
	} else {
		card, err = domainlink.NewLinkCard(shared.NewID(), u, now)
		if err != nil {
			return err
		}
	}

	meta, err := s.fetcher.Fetch(ctx, u)
	if err != nil {
		card.RecordFailure("网页预览抓取失败", time.Now())
		if saveErr := s.save(card); saveErr != nil {
			return saveErr
		}
		return err
	}
	pageURL := meta.PageURL
	if pageURL == "" {
		pageURL = u
	}
	imageURL := ""
	if src := absoluteImage(pageURL, meta.ImageURL); src != "" && s.covers != nil {
		imageURL, err = s.covers.Save(ctx, pageURL, src)
		if err != nil {
			// 刷新图片失败时继续用旧封面，完整页面失败时保留整个旧快照。
			imageURL = card.ImageURL()
			log.Debug().Err(err).Msg("链接预览封面未更新")
		}
	}
	card.RecordSuccess(meta.Title, meta.Description, meta.SiteName, imageURL, time.Now(), domainlink.DefaultTTL)
	return s.save(card)
}

func (s *Service) save(card *domainlink.LinkCard) error {
	// 上游预算耗尽后仍需落下失败终态，避免页面永远 pending。
	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()
	return s.repo.Save(ctx, card)
}

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
	if (abs.Scheme != "http" && abs.Scheme != "https") || abs.Host == "" || abs.User != nil {
		return ""
	}
	return abs.String()
}
