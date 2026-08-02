// Package audit 提供操作日志的领域模型与端口。
package audit

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// AuditLog 操作日志实体
type AuditLog struct {
	ID           int64          `json:"id"`            // 日志主键
	UserID       *string        `json:"user_id"`       // 操作人 ID（可空：匿名操作）
	UserName     string         `json:"user_name"`     // 操作人用户名（JOIN users 查出，可空）
	Action       string         `json:"action"`        // 操作类型：create/update/delete/login 等
	Resource     string         `json:"resource"`      // 资源类型：user/post/comment 等
	ResourceID   string         `json:"resource_id"`   // 资源 ID
	ResourceName string         `json:"resource_name"` // 资源名称（如用户名/文章标题，可空）
	Detail       map[string]any `json:"detail"`        // 变更详情
	IPAddress    string         `json:"ip_address"`    // 来源 IP
	CreatedAt    time.Time      `json:"created_at"`    // 发生时间（RFC3339）
}

// ListResult 日志列表结果（含分页）
type ListResult struct {
	// Logs 当前页的操作日志列表
	Logs []AuditLog
	// Total 符合筛选条件的总条数（供分页计算总页数）
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
