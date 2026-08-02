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
	// GroupsDone 已完成拉取的分组数
	GroupsDone int `json:"groups_done"`
	// GroupsTotal 待拉取的分组总数
	GroupsTotal int `json:"groups_total"`
}

// RefetchStatus 重新拉取任务状态快照（前端轮询读取）
type RefetchStatus struct {
	// State 任务状态（RefetchStateRunning/Done/Failed/Idle）
	State string `json:"state"`
	// StartedAt 任务开始时间（无任务时为 nil）
	StartedAt *time.Time `json:"started_at,omitempty"`
	// FinishedAt 任务结束时间（running 中为 nil）
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	// GroupsDone 已完成拉取的分组数
	GroupsDone int `json:"groups_done"`
	// GroupsTotal 分组总数（用于计算进度百分比）
	GroupsTotal int `json:"groups_total"`
	// Error 失败时的错误信息（成功时为空，omitempty 省略）
	Error string `json:"error,omitempty"`
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
