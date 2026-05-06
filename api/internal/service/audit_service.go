// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// AuditService 操作日志服务
type AuditService struct {
	queries *generated.Queries
}

// NewAuditService 创建操作日志服务实例
func NewAuditService(queries *generated.Queries) *AuditService {
	return &AuditService{queries: queries}
}

// AuditLogEntry 操作日志记录
type AuditLogEntry struct {
	UserID       uuid.NullUUID `json:"user_id"`
	UserName     string        `json:"user_name"`
	Action       string        `json:"action"`
	ResourceType string        `json:"resource_type"`
	ResourceID   string        `json:"resource_id"`
	ResourceName string        `json:"resource_name"`
	Detail       string        `json:"detail"`
	IPAddress    string        `json:"ip_address"`
}

// Log 记录操作日志
func (s *AuditService) Log(ctx context.Context, entry AuditLogEntry) error {
	log.Info().Str("service", "AuditService").Str("operation", "Log").
		Str("action", entry.Action).Str("resource_type", entry.ResourceType).Msg("记录操作日志")

	err := s.queries.CreateAuditLog(ctx, generated.CreateAuditLogParams{
		UserID:       entry.UserID,
		UserName:     sql.NullString{String: entry.UserName, Valid: entry.UserName != ""},
		Action:       entry.Action,
		ResourceType: entry.ResourceType,
		ResourceID:   sql.NullString{String: entry.ResourceID, Valid: entry.ResourceID != ""},
		ResourceName: sql.NullString{String: entry.ResourceName, Valid: entry.ResourceName != ""},
		Detail:       sql.NullString{String: entry.Detail, Valid: entry.Detail != ""},
		IpAddress:    sql.NullString{String: entry.IPAddress, Valid: entry.IPAddress != ""},
	})
	if err != nil {
		log.Error().Err(err).Msg("记录操作日志失败")
		return fmt.Errorf("记录操作日志失败: %w", err)
	}
	return nil
}

// LogWithDetail 记录操作日志（带结构化详情）
func (s *AuditService) LogWithDetail(ctx context.Context, entry AuditLogEntry, detail map[string]interface{}) error {
	if detail != nil {
		detailJSON, err := json.Marshal(detail)
		if err != nil {
			log.Error().Err(err).Msg("序列化详情失败")
		} else {
			entry.Detail = string(detailJSON)
		}
	}
	return s.Log(ctx, entry)
}

// AuditLogListResult 操作日志列表结果
type AuditLogListResult struct {
	Logs  []*generated.AuditLog `json:"logs"`
	Total int64                 `json:"total"`
	Page  int                   `json:"page"`
	Limit int                   `json:"limit"`
}

// ListLogs 获取操作日志列表（分页）
func (s *AuditService) ListLogs(ctx context.Context, page, limit int) (*AuditLogListResult, error) {
	log.Info().Str("service", "AuditService").Str("operation", "ListLogs").
		Int("page", page).Int("limit", limit).Msg("查询操作日志列表")

	if limit <= 0 {
		limit = 20
	}
	offset := page * limit

	logs, err := s.queries.ListAuditLogs(ctx, generated.ListAuditLogsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Error().Err(err).Msg("查询操作日志失败")
		return nil, fmt.Errorf("查询操作日志失败: %w", err)
	}

	total, err := s.queries.CountAuditLogs(ctx)
	if err != nil {
		log.Error().Err(err).Msg("统计操作日志失败")
		return nil, fmt.Errorf("统计操作日志失败: %w", err)
	}

	return &AuditLogListResult{
		Logs:  logs,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// ListLogsByUser 查询指定用户的操作日志
func (s *AuditService) ListLogsByUser(ctx context.Context, userID uuid.UUID, page, limit int) (*AuditLogListResult, error) {
	log.Info().Str("service", "AuditService").Str("operation", "ListLogsByUser").
		Str("user_id", userID.String()).Msg("查询用户操作日志")

	if limit <= 0 {
		limit = 20
	}
	offset := page * limit

	logs, err := s.queries.ListAuditLogsByUser(ctx, generated.ListAuditLogsByUserParams{
		UserID: uuid.NullUUID{UUID: userID, Valid: true},
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Error().Err(err).Msg("查询用户操作日志失败")
		return nil, fmt.Errorf("查询用户操作日志失败: %w", err)
	}

	return &AuditLogListResult{
		Logs:  logs,
		Total: int64(len(logs)),
		Page:  page,
		Limit: limit,
	}, nil
}