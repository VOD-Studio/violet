package coderunner

import (
	"context"

	domainshared "blog-api/internal/domain/shared"
)

// TaskRepository 执行任务的持久化接口。
//
// 实现位于 infrastructure/coderunner/redis_task_store.go，用 Redis 存任务
// JSON（带 TTL）。多副本部署时任务状态可共享。接口保持窄，仅 Save/Get/DeleteExpired。
type TaskRepository interface {
	// Save 保存或更新任务（upsert）。新任务与状态变更后都调此方法。
	Save(ctx context.Context, task *ExecutionTask) error
	// Get 按 ID 查任务，不存在返回 ErrTaskNotFound。
	Get(ctx context.Context, id domainshared.ID) (*ExecutionTask, error)
	// DeleteExpired 删除超过 TTL 的任务（GC，防止泄漏）。
	DeleteExpired(ctx context.Context) error
}

// 领域错误
var (
	ErrTaskNotFound = domainshared.NotFound("执行任务")
)
