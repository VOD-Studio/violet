// Package job - subscription_job.go 订阅定时抓取调度器（T8）。
//
// ticker 30 分钟轮询 due 订阅，有界并行 worker pool（默认 5）跨源并行抓取。
// 抓取 + 状态更新编排由 application/subscription.Service.FetchNow 承担，
// job 仅负责调度（查 due → 并行 FetchNow → 记日志）。
// 依赖方向：job（调度层）→ application/subscription + domain/subscription。
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

// SubscriptionFetcher 抓取编排端口（*appsub.Service 实现之）。
// 抽接口便于单测注入 fake（避免 runOnce 测试依赖真 Service + DB）。
// 用 FetchNow（抓取 + 状态更新完整编排）而非 FetchOne——状态机归 service 管。
type SubscriptionFetcher interface {
	FetchNow(ctx context.Context, subscriptionID string) appsub.FetchReport
}


// SubscriptionJob 订阅定时抓取调度器。
type SubscriptionJob struct {
	svc    SubscriptionFetcher                      // FetchNow 抓取编排
	repo   domainsubscription.SubscriptionRepository // FindDue 查到期订阅
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

// Start 启动调度器，阻塞至 ctx.Done。每轮：查 due → worker pool 并行 FetchNow。
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

// fetchAndUpdate 抓单个订阅（FetchNow 含状态更新），记日志。
func (j *SubscriptionJob) fetchAndUpdate(ctx context.Context, sub *domainsubscription.Subscription) {
	report := j.svc.FetchNow(ctx, sub.ID().String())

	if report.SubscriptionError == "" {
		log.Printf("[subscription_job] 订阅 %s 抓取成功：feed=%d 新=%d 导入=%d 失败=%d dead=%d 跳过=%d",
			sub.ID(), report.FeedEntryCount, report.NewEntries, report.Imported, report.Failed, report.Dead, report.Skipped)
	} else {
		log.Printf("[subscription_job] 订阅 %s 抓取失败：%s", sub.ID(), report.SubscriptionError)
	}
}

// recoverAndLog recover 单 worker panic，记日志不传播（隔离故障）。
func recoverAndLog(subID string) {
	if r := recover(); r != nil {
		log.Printf("[subscription_job] 订阅 %s 抓取 panic（已隔离）: %v", subID, r)
	}
}
