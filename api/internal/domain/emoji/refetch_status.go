package emoji

import (
	"context"
	"time"
)

// 重新拉取任务状态
const (
	RefetchStateRunning = "running"
	RefetchStateDone    = "done"
	RefetchStateFailed  = "failed"
	RefetchStateIdle    = "idle" // 无任务
)

// RefetchProgress 重新拉取进度（seed 执行过程中回调上报）
type RefetchProgress struct {
	GroupsDone  int `json:"groups_done"`
	GroupsTotal int `json:"groups_total"`
}

// RefetchStatus 重新拉取任务状态快照（前端轮询读取）
type RefetchStatus struct {
	State       string     `json:"state"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	FinishedAt  *time.Time `json:"finished_at,omitempty"`
	GroupsDone  int        `json:"groups_done"`
	GroupsTotal int        `json:"groups_total"`
	Error       string     `json:"error,omitempty"`
}

// RefetchStatusStore 重新拉取任务状态存储端口。
// 实现须保证 Acquire 的原子性与并发安全（Redis SET NX）。
type RefetchStatusStore interface {
	// Acquire 原子抢锁：已有任务运行返回 shared.Conflict（→ 409），
	// 否则标记 running 并开始计时。
	Acquire(ctx context.Context) error
	// SetProgress 更新进度。
	SetProgress(ctx context.Context, p RefetchProgress) error
	// SetDone 标记成功完成。
	SetDone(ctx context.Context) error
	// SetFailed 标记失败，记录错误信息。
	SetFailed(ctx context.Context, errMsg string) error
	// Get 读取当前状态（无任务返回 StateIdle）。
	Get(ctx context.Context) (*RefetchStatus, error)
}
