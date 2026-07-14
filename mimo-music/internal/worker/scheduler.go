// Package worker 提供 mimo-music 的异步任务 worker。
//
// worker 是独立进程（cmd/worker/main.go），和 server 生命周期分离。
// 通过 Asynq 调度定时任务，主要任务是 Cookie 健康检查。
package worker

import (
	"fmt"
	"time"

	"github.com/hibiken/asynq"

	"github.com/VOD-Studio/mimo-music/internal/worker/tasks"
)

// Scheduler 管理定时任务的注册和调度。
type Scheduler struct {
	// scheduler 是 Asynq 定时调度器。
	scheduler *asynq.Scheduler
}

// NewScheduler 创建定时调度器。
//
// checkIntervalHours 是 Cookie 健康检查间隔（小时）。
func NewScheduler(redisAddr string, checkIntervalHours int) *Scheduler {
	if checkIntervalHours <= 0 {
		checkIntervalHours = 6
	}

	spec := fmt.Sprintf("@every %dh", checkIntervalHours)
	scheduler := asynq.NewScheduler(
		asynq.RedisClientOpt{Addr: redisAddr},
		&asynq.SchedulerOpts{},
	)

	// 注册 Cookie 健康检查任务
	cookieTask, _ := tasks.NewCookieHealthTask()
	scheduler.Register(spec, cookieTask)

	return &Scheduler{scheduler: scheduler}
}

// Run 启动调度器（阻塞）。
func (s *Scheduler) Run() error {
	return s.scheduler.Run()
}

// Shutdown 关闭调度器。
func (s *Scheduler) Shutdown() {
	s.scheduler.Shutdown()
}

// intervalDuration 返回间隔对应的 duration（测试用）。
func intervalDuration(hours int) time.Duration {
	return time.Duration(hours) * time.Hour
}
