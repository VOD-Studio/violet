package gorm

import (
	"context"
	"sync"
	"testing"
	"time"

	domain "blog-api/internal/domain/omp_usage"

	"github.com/stretchr/testify/require"
)

func usageEvent(id string, when time.Time) domain.UsageEvent {
	return domain.UsageEvent{ClientEventID: id, Provider: "test", Model: "model", InputTokens: 100, OutputTokens: 20,
		CacheReadTokens: 50, CacheWriteTokens: 10, ReasoningTokens: 5, CostTotal: 0.25,
		StopReason: "stop", DurationMS: new(float64(2000)), TTFTMS: new(float64(1000)), OMPVersion: "1.0", OccurredAt: when}
}

func TestOMPUsageRepositoryIntegrationArithmeticBoundariesAndIsolation(t *testing.T) {
	repo := NewOMPUsageRepository(setupIntegrationDB(t))
	ctx := context.Background()
	start := time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 10, 23, 12, 30, 0, 0, time.UTC)
	first := usageEvent("first", start)
	second := usageEvent("second", end)
	second.InputTokens, second.OutputTokens, second.CacheReadTokens, second.CacheWriteTokens = 0, 60, 0, 0
	second.ReasoningTokens, second.CostTotal = 10, 0.5
	second.DurationMS, second.TTFTMS = new(float64(3000)), new(float64(1000))
	failed := usageEvent("failed", end.Add(-time.Hour))
	failed.InputTokens, failed.OutputTokens, failed.CacheReadTokens, failed.CacheWriteTokens = 0, 10, 0, 0
	failed.ReasoningTokens, failed.CostTotal, failed.IsError = 0, 0.125, true
	failed.DurationMS, failed.TTFTMS = new(float64(0)), new(float64(0))
	missing := usageEvent("missing", end.Add(-2*time.Hour))
	missing.InputTokens, missing.OutputTokens, missing.CacheReadTokens, missing.CacheWriteTokens = 0, 0, 0, 0
	missing.ReasoningTokens, missing.CostTotal = 0, 0
	missing.DurationMS, missing.TTFTMS = nil, nil
	before, after := usageEvent("before", start.Add(-time.Microsecond)), usageEvent("after", end.Add(time.Microsecond))
	result, err := repo.Ingest(ctx, "alice", []domain.UsageEvent{first, second, failed, missing, before, after, first})
	require.NoError(t, err)
	require.Equal(t, domain.IngestResult{Accepted: 6, Duplicated: 1}, result)
	first.OutputTokens = 9999
	result, err = repo.Ingest(ctx, "alice", []domain.UsageEvent{first})
	require.NoError(t, err)
	require.Equal(t, domain.IngestResult{Duplicated: 1}, result)
	_, err = repo.Ingest(ctx, "bob", []domain.UsageEvent{first})
	require.NoError(t, err)

	summary, err := repo.Summary(ctx, "alice", start, end)
	require.NoError(t, err)
	require.EqualValues(t, 4, summary.Requests)
	require.EqualValues(t, 1, summary.Errors)
	require.Equal(t, 0.25, summary.ErrorRate)
	require.Equal(t, float64(250), summary.TotalTokens)
	require.Equal(t, float64(100), summary.InputTokens)
	require.Equal(t, float64(90), summary.OutputTokens)
	require.Equal(t, float64(50), summary.CacheReadTokens)
	require.Equal(t, float64(10), summary.CacheWriteTokens)
	require.Equal(t, float64(15), summary.ReasoningTokens)
	require.Equal(t, 0.3125, summary.CacheRate)
	require.Equal(t, 0.875, summary.APICostEstimate)
	require.InDelta(t, 1666.6666666667, summary.AvgDurationMS, 0.00001)
	require.InDelta(t, 666.6666666667, summary.AvgTTFTMS, 0.00001)
	require.Equal(t, float64(25), summary.AvgTokensPerSecond, "单次速率的均值，不是 token 总量除以耗时总量")

	models, err := repo.Models(ctx, "alice", start, end)
	require.NoError(t, err)
	require.Len(t, models, 1)
	require.Equal(t, float64(250), models[0].TotalTokens)
	require.Equal(t, 0.875, models[0].Cost)
	require.Equal(t, float64(25), models[0].AvgTokensPerSecond)
	points, err := repo.Timeseries(ctx, "alice", start, end, "day")
	require.NoError(t, err)
	require.Len(t, points, 7)
	require.Equal(t, start, points[0].Timestamp)
	require.EqualValues(t, 1, points[0].Requests)
	require.EqualValues(t, 0, points[1].Requests)
	require.EqualValues(t, 3, points[6].Requests)
	require.EqualValues(t, 70, points[6].TotalTokens)

	empty, err := repo.Summary(ctx, "empty", start, end)
	require.NoError(t, err)
	require.Equal(t, domain.Summary{}, empty)
	emptyModels, err := repo.Models(ctx, "empty", start, end)
	require.NoError(t, err)
	require.NotNil(t, emptyModels)
	require.Empty(t, emptyModels)
	hours, err := repo.Timeseries(ctx, "empty", start, end, "hour")
	require.NoError(t, err)
	require.Len(t, hours, 157)
	require.Equal(t, end.Truncate(time.Hour), hours[len(hours)-1].Timestamp)
	for _, point := range hours {
		require.Zero(t, point.Requests)
		require.Zero(t, point.APICostEstimate)
	}
}

func TestOMPUsageRepositoryIntegrationConcurrentDedupAndModelOrdering(t *testing.T) {
	repo := NewOMPUsageRepository(setupIntegrationDB(t))
	ctx := context.Background()
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	event := usageEvent("same", now)
	var wait sync.WaitGroup
	results := make(chan domain.IngestResult, 12)
	errors := make(chan error, 12)
	for range 12 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			result, err := repo.Ingest(ctx, "alice", []domain.UsageEvent{event})
			results <- result
			errors <- err
		}()
	}
	wait.Wait()
	close(results)
	close(errors)
	var accepted, duplicated int64
	for err := range errors {
		require.NoError(t, err)
	}
	for result := range results {
		accepted += result.Accepted
		duplicated += result.Duplicated
	}
	require.EqualValues(t, 1, accepted)
	require.EqualValues(t, 11, duplicated)
	for _, key := range []struct{ id, provider, model string }{{"a", "a", "z"}, {"b", "a", "a"}} {
		item := usageEvent(key.id, now)
		item.Provider, item.Model = key.provider, key.model
		item.DurationMS, item.TTFTMS = new(float64(100)), new(float64(200))
		_, err := repo.Ingest(ctx, "alice", []domain.UsageEvent{item})
		require.NoError(t, err)
	}
	models, err := repo.Models(ctx, "alice", now.Add(-time.Hour), now)
	require.NoError(t, err)
	require.Len(t, models, 3)
	require.Equal(t, "a", models[0].Provider)
	require.Equal(t, "a", models[0].Model)
	require.Equal(t, "z", models[1].Model)
	require.Zero(t, models[0].AvgTokensPerSecond)
}
