package runtimelog

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

var ErrPolicyVersionConflict = shared.Conflict("运行日志保留策略已被其他管理员修改")

type Policy struct {
	// Version 乐观并发版本；首次迁移为零。
	Version int64 `json:"version"`
	// RetentionDays 按接收时间保留的完整天数。
	RetentionDays int `json:"retention_days"`
	// MaxRecords 轮转后允许保留的最大记录数。
	MaxRecords int64 `json:"max_records"`
	// MaxBytes 轮转后允许保留的最大日志字段估算字节数，不含 PostgreSQL 索引页。
	MaxBytes int64 `json:"max_bytes"`
	// UpdatedAt 最近一次策略写入时间。
	UpdatedAt time.Time `json:"updated_at"`
}

type Usage struct {
	// Records 当前运行日志记录数。
	Records int64 `json:"records"`
	// PayloadBytes 当前日志字段估算字节数，不含 PostgreSQL 索引页。
	PayloadBytes int64 `json:"payload_bytes"`
	// OldestReceivedAt 当前最早记录的接收时间；空库为 nil。
	OldestReceivedAt *time.Time `json:"oldest_received_at"`
	// NewestReceivedAt 当前最晚记录的接收时间；空库为 nil。
	NewestReceivedAt *time.Time `json:"newest_received_at"`
}

type MaintenanceStore interface {
	GetPolicy(context.Context) (Policy, error)
	UpdatePolicy(context.Context, int64, Policy) (Policy, error)
	Usage(context.Context) (Usage, error)
	RotateBatch(context.Context, Policy, time.Time, int) (int64, error)
}
