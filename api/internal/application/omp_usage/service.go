package ompusage

import (
	"context"
	"math"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	domain "blog-api/internal/domain/omp_usage"
	"blog-api/internal/domain/shared"
)

const MaxBatchSize = 200
const MaxSafeInteger int64 = 9007199254740991

// 单次调用上限远高于真实模型消费，防止浮点聚合被极端输入溢出。
const MaxCostUSD = 1e12

// 指针区分缺失/null 与合法的 0/false；耗时字段允许缺测。
type EventInput struct {
	ClientEventID    string   `json:"client_event_id"`
	Provider         string   `json:"provider"`
	Model            string   `json:"model"`
	InputTokens      *int64   `json:"input_tokens"`
	OutputTokens     *int64   `json:"output_tokens"`
	CacheReadTokens  *int64   `json:"cache_read_tokens"`
	CacheWriteTokens *int64   `json:"cache_write_tokens"`
	ReasoningTokens  *int64   `json:"reasoning_tokens"`
	CostTotal        *float64 `json:"cost_total"`
	StopReason       string   `json:"stop_reason"`
	IsError          *bool    `json:"is_error"`
	DurationMS       *float64 `json:"duration_ms"`
	TTFTMS           *float64 `json:"ttft_ms"`
	IsSubagent       *bool    `json:"is_subagent"`
	OMPVersion       string   `json:"omp_version"`
	OccurredAt       string   `json:"occurred_at"`
}

type Service struct {
	repo domain.Repository
	now  func() time.Time
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func (s *Service) Ingest(ctx context.Context, userID string, inputs []EventInput) (domain.IngestResult, error) {
	if userID == "" {
		return domain.IngestResult{}, shared.Unauthorized("请先认证")
	}
	if len(inputs) == 0 || len(inputs) > MaxBatchSize {
		return domain.IngestResult{}, shared.BadRequest("events 数量须为 1 到 200")
	}
	now := s.now().UTC()
	events := make([]domain.UsageEvent, len(inputs))
	for i, input := range inputs {
		event, err := input.event(userID, now)
		if err != nil {
			return domain.IngestResult{}, err
		}
		events[i] = event
	}
	return s.repo.Ingest(ctx, userID, events)
}

func (input EventInput) event(userID string, now time.Time) (domain.UsageEvent, error) {
	invalid := func() (domain.UsageEvent, error) {
		return domain.UsageEvent{}, shared.BadRequest("用量事件字段缺失或无效")
	}
	if !validText(input.ClientEventID, 128) || !validText(input.Provider, 128) ||
		!validText(input.Model, 256) || !validText(input.StopReason, 32) || !validText(input.OMPVersion, 64) {
		return invalid()
	}
	for _, c := range input.ClientEventID {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && !strings.ContainsRune("._:-", c) {
			return invalid()
		}
	}
	for _, count := range []*int64{input.InputTokens, input.OutputTokens, input.CacheReadTokens, input.CacheWriteTokens, input.ReasoningTokens} {
		if count == nil || *count < 0 || *count > MaxSafeInteger {
			return invalid()
		}
	}
	if input.CostTotal == nil || !finiteNonnegative(*input.CostTotal) || *input.CostTotal > MaxCostUSD || input.IsError == nil || input.IsSubagent == nil {
		return invalid()
	}
	for _, timing := range []*float64{input.DurationMS, input.TTFTMS} {
		if timing != nil && (!finiteNonnegative(*timing) || *timing > float64(MaxSafeInteger)) {
			return invalid()
		}
	}
	occurred, err := time.Parse(time.RFC3339Nano, input.OccurredAt)
	if err != nil || !strings.HasSuffix(input.OccurredAt, "Z") || strings.Contains(input.OccurredAt, ",") || occurred.Year() < 1 || occurred.After(now.Add(5*time.Minute)) {
		return invalid()
	}
	return domain.UsageEvent{
		UserID: userID, ClientEventID: input.ClientEventID, Provider: input.Provider, Model: input.Model,
		InputTokens: *input.InputTokens, OutputTokens: *input.OutputTokens, CacheReadTokens: *input.CacheReadTokens,
		CacheWriteTokens: *input.CacheWriteTokens, ReasoningTokens: *input.ReasoningTokens, CostTotal: *input.CostTotal,
		StopReason: input.StopReason, IsError: *input.IsError, DurationMS: input.DurationMS, TTFTMS: input.TTFTMS,
		IsSubagent: *input.IsSubagent, OMPVersion: input.OMPVersion, OccurredAt: occurred.UTC(), CreatedAt: now,
	}, nil
}

func finiteNonnegative(value float64) bool {
	return value >= 0 && !math.IsNaN(value) && !math.IsInf(value, 0)
}

func validText(value string, maximum int) bool {
	return len(value) <= maximum && strings.TrimSpace(value) != "" && utf8.ValidString(value) &&
		!strings.ContainsFunc(value, unicode.IsControl)
}
