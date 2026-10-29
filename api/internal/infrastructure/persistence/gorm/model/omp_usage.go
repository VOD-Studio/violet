package model

import "time"

type OMPUsageEvent struct {
	UserID           string    `gorm:"column:user_id;primaryKey" json:"-"`
	ClientEventID    string    `gorm:"column:client_event_id;primaryKey" json:"client_event_id"`
	Provider         string    `gorm:"column:provider" json:"provider"`
	Model            string    `gorm:"column:model" json:"model"`
	InputTokens      int64     `gorm:"column:input_tokens" json:"input_tokens"`
	OutputTokens     int64     `gorm:"column:output_tokens" json:"output_tokens"`
	CacheReadTokens  int64     `gorm:"column:cache_read_tokens" json:"cache_read_tokens"`
	CacheWriteTokens int64     `gorm:"column:cache_write_tokens" json:"cache_write_tokens"`
	ReasoningTokens  int64     `gorm:"column:reasoning_tokens" json:"reasoning_tokens"`
	CostTotal        float64   `gorm:"column:cost_total" json:"cost_total"`
	StopReason       string    `gorm:"column:stop_reason" json:"stop_reason"`
	IsError          bool      `gorm:"column:is_error" json:"is_error"`
	DurationMS       *float64  `gorm:"column:duration_ms" json:"duration_ms"`
	TTFTMS           *float64  `gorm:"column:ttft_ms" json:"ttft_ms"`
	IsSubagent       bool      `gorm:"column:is_subagent" json:"is_subagent"`
	OMPVersion       string    `gorm:"column:omp_version" json:"omp_version"`
	OccurredAt       time.Time `gorm:"column:occurred_at" json:"occurred_at"`
	CreatedAt        time.Time `gorm:"column:created_at" json:"-"`
}

func (OMPUsageEvent) TableName() string { return "omp_usage_events" }
