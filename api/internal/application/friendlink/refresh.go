package friendlink

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	domain "blog-api/internal/domain/friendlink"
)

// ActivityFetcher 分别探测首页和 RSS；单站点失败只体现在该站快照中。
type ActivityFetcher interface {
	Fetch(ctx context.Context, siteURL, rssURL string) domain.Activity
}

// RefreshWorker 以固定批次和四个并发请求刷新批准项，不参与列表请求。
type RefreshWorker struct {
	repo    domain.ActivityRepository
	fetcher ActivityFetcher
}

func NewRefreshWorker(repo domain.ActivityRepository, fetcher ActivityFetcher) *RefreshWorker {
	return &RefreshWorker{repo: repo, fetcher: fetcher}
}

// Run 启动时刷新一次，之后每分钟领取最多 24 条；ctx 取消会终止网络请求和循环。
func (w *RefreshWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if err := w.Refresh(ctx); err != nil && ctx.Err() == nil {
			log.Warn().Err(err).Msg("刷新友链失败")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (w *RefreshWorker) Refresh(ctx context.Context) error {
	links, err := w.repo.ClaimRefreshBatch(ctx, time.Now().UTC(), 24)
	if err != nil {
		return err
	}
	jobs := make(chan *domain.FriendLink)
	var workers sync.WaitGroup
	for range min(4, len(links)) {
		workers.Go(func() {
			for link := range jobs {
				if !link.IsApproved() || ctx.Err() != nil {
					continue
				}
				activity := w.fetcher.Fetch(ctx, link.URL(), link.RSSURL())
				if err := w.repo.SaveActivity(ctx, link, activity); err != nil && ctx.Err() == nil {
					log.Warn().Err(err).Str("friendlink_id", link.ID().String()).Msg("保存友链快照失败")
				}
			}
		})
	}
	for _, link := range links {
		select {
		case jobs <- link:
		case <-ctx.Done():
			close(jobs)
			workers.Wait()
			return ctx.Err()
		}
	}
	close(jobs)
	workers.Wait()
	return ctx.Err()
}
