// Package audit 提供操作日志的应用用例。
package audit

import (
	"context"

	domainaudit "blog-api/internal/domain/audit"
)

// Service 操作日志用例服务
type Service struct {
	store domainaudit.AuditStore
}

// NewService 构造日志服务
func NewService(store domainaudit.AuditStore) *Service {
	return &Service{store: store}
}

// Log 写入操作日志（简化版）
//
// ua（User-Agent）参数保留以维持调用方兼容，但当前 PO 无 user_agent 列，
// 不持久化；待后端补齐该列后再恢复写入。
func (s *Service) Log(ctx context.Context, action, resource, resourceID, userID, ip, ua string) error {
	_ = ua // PO 无 user_agent 列，暂不持久化
	entry := domainaudit.AuditLog{
		Action: action, Resource: resource, ResourceID: resourceID,
		IPAddress: ip,
	}
	if userID != "" {
		entry.UserID = &userID
	}
	return s.store.Append(ctx, entry)
}

// LogWithDetail 写入带详情的操作日志
//
// ua（User-Agent）参数保留以维持调用方兼容，但当前 PO 无 user_agent 列，
// 不持久化；待后端补齐该列后再恢复写入。
func (s *Service) LogWithDetail(ctx context.Context, action, resource, resourceID, userID, ip, ua string, detail map[string]any) error {
	_ = ua // PO 无 user_agent 列，暂不持久化
	entry := domainaudit.AuditLog{
		Action: action, Resource: resource, ResourceID: resourceID,
		Detail: detail, IPAddress: ip,
	}
	if userID != "" {
		entry.UserID = &userID
	}
	return s.store.Append(ctx, entry)
}

// List 分页查询日志
func (s *Service) List(ctx context.Context, page, limit int) (domainaudit.ListResult, error) {
	return s.store.List(ctx, page, limit)
}

// ListByUser 分页查询指定用户日志
func (s *Service) ListByUser(ctx context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	return s.store.ListByUser(ctx, userID, page, limit)
}
