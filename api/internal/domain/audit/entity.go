// Package audit 提供操作日志的领域模型与端口。
package audit

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// AuditLog 操作日志实体
type AuditLog struct {
	ID        int64
	UserID    *string // 可空（匿名操作）
	Action    string  // 操作类型：create/update/delete/login 等
	Resource  string  // 资源类型：user/post/comment 等
	ResourceID string // 资源 ID
	Detail    map[string]any // 变更详情
	IPAddress string
	UserAgent string
	CreatedAt time.Time
}

// ListResult 日志列表结果（含分页）
type ListResult struct {
	Logs  []AuditLog
	Total int64
}

// AuditStore 操作日志存储端口
type AuditStore interface {
	// Append 写入一条操作日志
	Append(ctx context.Context, entry AuditLog) error
	// List 分页查询全部日志
	List(ctx context.Context, page, limit int) (ListResult, error)
	// ListByUser 分页查询指定用户的日志
	ListByUser(ctx context.Context, userID string, page, limit int) (ListResult, error)
}

var ErrInvalidLog = shared.BadRequest("无效的操作日志")
