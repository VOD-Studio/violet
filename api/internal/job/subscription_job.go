// Package job - subscription_job.go 订阅定时抓取调度器（T8）。
//
// ticker 30 分钟轮询 due 订阅，有界并行 worker pool（默认 5）跨源并行抓取，
// 据 FetchReport.FeedErr 走失败状态机（429/4xx/瞬时分类）。
// 依赖方向：job（装配/调度层）→ application/subscription + domain/subscription。
package job

import (
	"context"
	"log"
	"sync"
	"time"

	appsub "blog-api/internal/application/subscription"
	domainsubscription "blog-api/internal/domain/subscription"
)

// dueOversubscribeFactor FindDue 取 worker 数的多少倍候选，让 worker pool 吃满。
// 订阅量小时一轮全取；量大时多取些避免 worker 空闲。
const dueOversubscribeFactor = 4

// defaultRateLimitBackoff 429 无 Retry-After 头时的默认退避时长。
// 源站限流却不给重试时间时，按 1h 推迟避免每轮照打。
const defaultRateLimitBackoff = time.Hour

// SubscriptionFetcher FetchOne 抓取编排端口（*appsub.Service 实现之）。
// 抽接口便于单测注入 fake（避免 runOnce 测试依赖真 Service + DB）。
type SubscriptionFetcher interface {
	FetchOne(ctx context.Context, subscriptionID string) appsub.FetchReport
}

// SubscriptionJob 订阅定时抓取调度器。
type SubscriptionJob struct {
	svc    SubscriptionFetcher               // FetchOne 抓取编排
	repo   domainsubscription.SubscriptionRepository // FindDue + Save 状态回写
	now    func() time.Time
	worker int           // worker pool 大小（默认 5）
	tick   time.Duration // 轮询间隔（默认 30 分钟，测试可缩短）
}

// NewSubscriptionJob 构造调度器。worker/tick 为 0 时用默认（5 / 30min）。
func NewSubscriptionJob(svc SubscriptionFetcher, repo domainsubscription.SubscriptionRepository, now func() time.Time, worker int, tick time.Duration) *SubscriptionJob {
	if now == nil {
		now = time.Now
	}
	if worker <= 0 {
		worker = 5
	}
	if tick <= 0 {
		tick = 30 * time.Minute
	}
	return &SubscriptionJob{svc: svc, repo: repo, now: now, worker: worker, tick: tick}
}

// Start 启动调度器，阻塞至 ctx.Done。每轮：查 due → worker pool 并行 FetchOne → 状态回写。
func (j *SubscriptionJob) Start(ctx context.Context) {
	ticker := time.NewTicker(j.tick)
	defer ticker.Stop()
	log.Printf("[subscription_job] 启动，轮询间隔 %v，worker=%d", j.tick, j.worker)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[subscription_job] 收到关闭信号，退出")
			return
		case <-ticker.C:
			j.runOnce(ctx)
		}
	}
}

// runOnce 执行一轮抓取。单订阅 panic 不影响其它（每 worker recover）。
// 用 sync.WaitGroup 排空 in-flight worker，保证优雅关闭。
func (j *SubscriptionJob) runOnce(ctx context.Context) {
	now := j.now()
	subs, err := j.repo.FindDue(ctx, now, j.worker*dueOversubscribeFactor)
	if err != nil {
		log.Printf("[subscription_job] 查 due 订阅失败: %v", err)
		return
	}
	if len(subs) == 0 {
		return
	}

	sem := make(chan struct{}, j.worker) // 信号量限并发
	var wg sync.WaitGroup
	for _, sub := range subs {
		// 提前响应关闭：不再启动新 worker，但等已启动的完成
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		default:
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(s *domainsubscription.Subscription) {
			defer wg.Done()
			defer func() { <-sem }()
			defer recoverAndLog(s.ID().String())
			j.fetchAndUpdate(ctx, s)
		}(sub)
	}
	wg.Wait()
}

// fetchAndUpdate 抓单个订阅并据 FetchReport 更新订阅状态（失败状态机）。
func (j *SubscriptionJob) fetchAndUpdate(ctx context.Context, sub *domainsubscription.Subscription) {
	now := j.now()
	report := j.svc.FetchOne(ctx, sub.ID().String())

	if report.SubscriptionError == "" {
		// feed 拉取成功（即便部分 entry 失败，feed 层算成功）→ 清零计数 + 推进 next_fetch_at
		sub.RecordSuccess(now)
		log.Printf("[subscription_job] 订阅 %s 抓取成功：feed=%d 新=%d 导入=%d 失败=%d dead=%d 跳过=%d",
			sub.ID(), report.FeedEntryCount, report.NewEntries, report.Imported, report.Failed, report.Dead, report.Skipped)
	} else {
		j.applyFeedError(sub, report.FeedErr, now, report.SubscriptionError)
	}

	if err := j.repo.Save(ctx, sub); err != nil {
		log.Printf("[subscription_job] 订阅 %s 状态回写失败: %v", sub.ID(), err)
	}
}

// applyFeedError 据 FeedError 分类更新订阅状态（PRD Q5 Miniflux 共识）：
//   - RateLimited (429)：推迟 retry_after_until，不增计数。
//     无 Retry-After 头时用默认退避 defaultRateLimitBackoff，避免每轮照打不收敛。
//   - Permanent (4xx/malformed)：立即 Pause
//   - Transient (5xx/网络)：RecordFailure 计数，达阈值自动 paused
//
// feedErr 为 nil（非 *FeedError，如 FindByID 失败）时按瞬时错误处理。
func (j *SubscriptionJob) applyFeedError(sub *domainsubscription.Subscription, feedErr *appsub.FeedError, now time.Time, desc string) {
	if feedErr != nil {
		switch feedErr.Kind {
		case appsub.FeedErrRateLimited:
			until := feedErr.RetryAfter
			if until == nil {
				// 429 但无 Retry-After 头（GoFeedParser parseRetryAfter 返回 nil）：
				// 默认退避 1h，否则不推迟不增计数，每 30min 照打源站不收敛
				def := now.Add(defaultRateLimitBackoff)
				until = &def
			}
			sub.SetRetryAfter(*until)
			log.Printf("[subscription_job] 订阅 %s 被 429 限流，推迟到 %v（不增计数）",
				sub.ID(), until)
			return
		case appsub.FeedErrPermanent:
			sub.Pause()
			log.Printf("[subscription_job] 订阅 %s 永久错误，立即 paused: %s", sub.ID(), desc)
			return
		case appsub.FeedErrTransient:
			// 落到下面 RecordFailure
		}
	}

	// 默认/瞬时错误：累积失败计数
	paused := sub.RecordFailure(now, desc)
	if paused {
		log.Printf("[subscription_job] 订阅 %s 连续失败达 %d 次，自动 paused",
			sub.ID(), domainsubscription.MaxConsecutiveFailures)
	} else {
		log.Printf("[subscription_job] 订阅 %s 瞬时失败（计数 %d/%d）: %s",
			sub.ID(), sub.ConsecutiveFailures(), domainsubscription.MaxConsecutiveFailures, desc)
	}
}

// recoverAndLog recover 单 worker panic，记日志不传播（隔离故障）。
func recoverAndLog(subID string) {
	if r := recover(); r != nil {
		log.Printf("[subscription_job] 订阅 %s 抓取 panic（已隔离）: %v", subID, r)
	}
}
