package gorm

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/gorm"

	domain "blog-api/internal/domain/omp_usage"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/pkg/ompusage"
)

type OMPUsageRepository struct{ db *gorm.DB }

func NewOMPUsageRepository(db *gorm.DB) *OMPUsageRepository { return &OMPUsageRepository{db: db} }

func (r *OMPUsageRepository) Ingest(ctx context.Context, userID string, events []domain.UsageEvent) (domain.IngestResult, error) {
	rows := make([]model.OMPUsageEvent, len(events))
	for i, e := range events {
		rows[i] = model.OMPUsageEvent{
			UserID: userID, ClientEventID: e.ClientEventID, Provider: e.Provider, Model: e.Model,
			InputTokens: e.InputTokens, OutputTokens: e.OutputTokens, CacheReadTokens: e.CacheReadTokens,
			CacheWriteTokens: e.CacheWriteTokens, ReasoningTokens: e.ReasoningTokens, CostTotal: e.CostTotal,
			StopReason: e.StopReason, IsError: e.IsError, DurationMS: e.DurationMS, TTFTMS: e.TTFTMS,
			IsSubagent: e.IsSubagent, OMPVersion: e.OMPVersion, OccurredAt: e.OccurredAt,
		}
	}
	payload, err := json.Marshal(rows)
	if err != nil {
		return domain.IngestResult{}, shared.Internal("编码用量失败", err)
	}
	db, err := r.db.DB()
	if err != nil {
		return domain.IngestResult{}, shared.Internal("读取用量数据库失败", err)
	}
	var result domain.IngestResult
	err = db.QueryRowContext(ctx, ompusage.IngestSQL, userID, string(payload)).Scan(&result.Accepted, &result.Duplicated)
	if err != nil {
		return result, shared.Internal("保存用量失败", err)
	}
	return result, nil
}

func (r *OMPUsageRepository) Summary(ctx context.Context, userID string, start, end time.Time) (domain.Summary, error) {
	var result domain.Summary
	db, err := r.db.DB()
	if err != nil {
		return result, shared.Internal("读取用量数据库失败", err)
	}
	err = db.QueryRowContext(ctx, ompusage.SummarySQL, userID, start, end).Scan(
		&result.Requests, &result.Errors, &result.ErrorRate, &result.TotalTokens,
		&result.InputTokens, &result.OutputTokens, &result.CacheReadTokens, &result.CacheWriteTokens,
		&result.ReasoningTokens, &result.CacheRate, &result.APICostEstimate,
		&result.AvgDurationMS, &result.AvgTTFTMS, &result.AvgTokensPerSecond,
	)
	if err != nil {
		return result, shared.Internal("聚合用量失败", err)
	}
	return result, nil
}

func (r *OMPUsageRepository) Models(ctx context.Context, userID string, start, end time.Time) ([]domain.ModelUsage, error) {
	db, err := r.db.DB()
	if err != nil {
		return nil, shared.Internal("读取用量数据库失败", err)
	}
	rows, err := db.QueryContext(ctx, ompusage.ModelsSQL, userID, start, end)
	if err != nil {
		return nil, shared.Internal("聚合模型用量失败", err)
	}
	defer rows.Close()
	result := make([]domain.ModelUsage, 0)
	for rows.Next() {
		var item domain.ModelUsage
		if err := rows.Scan(&item.Provider, &item.Model, &item.Requests, &item.Errors, &item.TotalTokens,
			&item.InputTokens, &item.OutputTokens, &item.CacheReadTokens, &item.CacheWriteTokens,
			&item.ReasoningTokens, &item.CacheRate, &item.Cost, &item.AvgTokensPerSecond, &item.AvgTTFTMS); err != nil {
			return nil, shared.Internal("读取模型用量失败", err)
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, shared.Internal("读取模型用量失败", err)
	}
	return result, nil
}

func (r *OMPUsageRepository) Timeseries(ctx context.Context, userID string, start, end time.Time, bucket string) ([]domain.Point, error) {
	db, err := r.db.DB()
	if err != nil {
		return nil, shared.Internal("读取用量数据库失败", err)
	}
	rows, err := db.QueryContext(ctx, ompusage.TimeseriesSQL, userID, start, end, bucket)
	if err != nil {
		return nil, shared.Internal("聚合用量趋势失败", err)
	}
	defer rows.Close()
	result := make([]domain.Point, 0)
	for rows.Next() {
		var item domain.Point
		if err := rows.Scan(&item.Timestamp, &item.Requests, &item.Errors, &item.TotalTokens, &item.APICostEstimate); err != nil {
			return nil, shared.Internal("读取用量趋势失败", err)
		}
		item.Timestamp = item.Timestamp.UTC()
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, shared.Internal("读取用量趋势失败", err)
	}
	return result, nil
}

var _ domain.Repository = (*OMPUsageRepository)(nil)
