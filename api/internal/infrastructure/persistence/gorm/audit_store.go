// Package gorm 提供 audit 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/gorm"

	domainaudit "blog-api/internal/domain/audit"
)

// AuditLog 操作日志 PO
type AuditLog struct {
	ID           int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       *string        `gorm:"type:uuid;column:user_id" json:"user_id"`
	UserName     string         `gorm:"->" json:"user_name"` // join users.username
	Action       string         `gorm:"type:varchar(50)" json:"action"`
	ResourceType string         `gorm:"type:varchar(50);column:resource_type" json:"resource_type"`
	ResourceID   string         `gorm:"type:varchar(255);column:resource_id" json:"resource_id"`
	ResourceName string         `gorm:"type:varchar(255);column:resource_name" json:"resource_name"`
	Detail       string         `gorm:"type:jsonb" json:"detail"`
	IPAddress    string         `gorm:"type:varchar(45);column:ip_address" json:"ip_address"`
	CreatedAt    time.Time      `gorm:"not null;default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (AuditLog) TableName() string { return "audit_logs" }

// AuditStore 实现领域 AuditStore 端口
type AuditStore struct{ db *gorm.DB }

// NewAuditStore 创建审计日志存储
func NewAuditStore(db *gorm.DB) *AuditStore {
	return &AuditStore{db: db}
}

func (s *AuditStore) Append(ctx context.Context, entry domainaudit.AuditLog) error {
	po := AuditLog{
		Action: entry.Action, ResourceType: entry.Resource,
		ResourceID: entry.ResourceID, IPAddress: entry.IPAddress,
	}
	if entry.UserID != nil {
		po.UserID = entry.UserID
	}
	if entry.Detail != nil {
		if b, err := json.Marshal(entry.Detail); err == nil {
			po.Detail = string(b)
		}
	}
	return s.db.WithContext(ctx).Create(&po).Error
}

func (s *AuditStore) List(ctx context.Context, page, limit int) (domainaudit.ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	var total int64
	s.db.WithContext(ctx).Model(&AuditLog{}).Count(&total)
	var pos []AuditLog
	s.db.WithContext(ctx).
		Select("audit_logs.*, u.username AS user_name").
		Joins("LEFT JOIN users u ON u.id = audit_logs.user_id").
		Order("audit_logs.created_at DESC").
		Offset(offset).Limit(limit).
		Scan(&pos)
	return domainaudit.ListResult{Logs: auditPOsToDomain(pos), Total: total}, nil
}

func (s *AuditStore) ListByUser(ctx context.Context, userID string, page, limit int) (domainaudit.ListResult, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit
	query := s.db.WithContext(ctx).Model(&AuditLog{}).Where("user_id = ?", userID)
	var total int64
	query.Count(&total)
	var pos []AuditLog
	query.
		Select("audit_logs.*, u.username AS user_name").
		Joins("LEFT JOIN users u ON u.id = audit_logs.user_id").
		Order("audit_logs.created_at DESC").
		Offset(offset).Limit(limit).
		Scan(&pos)
	return domainaudit.ListResult{Logs: auditPOsToDomain(pos), Total: total}, nil
}

func auditPOsToDomain(pos []AuditLog) []domainaudit.AuditLog {
	logs := make([]domainaudit.AuditLog, 0, len(pos))
	for _, po := range pos {
		l := domainaudit.AuditLog{
			ID: po.ID, Action: po.Action, Resource: po.ResourceType,
			ResourceID: po.ResourceID, IPAddress: po.IPAddress, CreatedAt: po.CreatedAt,
		}
		if po.UserID != nil {
			uid := *po.UserID
			l.UserID = &uid
		}
		if po.Detail != "" {
			var d map[string]any
			if json.Unmarshal([]byte(po.Detail), &d) == nil {
				l.Detail = d
			}
		}
		logs = append(logs, l)
	}
	return logs
}
