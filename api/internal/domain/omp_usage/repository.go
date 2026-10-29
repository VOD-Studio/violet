package ompusage

import (
	"context"
	"time"
)

type Repository interface {
	Ingest(context.Context, string, []UsageEvent) (IngestResult, error)
	Summary(context.Context, string, time.Time, time.Time) (Summary, error)
	Models(context.Context, string, time.Time, time.Time) ([]ModelUsage, error)
	Timeseries(context.Context, string, time.Time, time.Time, string) ([]Point, error)
}

type IngestResult struct {
	// Accepted 计新增行；批内重复只接收首次出现的事件。
	Accepted int64 `json:"accepted"`
	// Duplicated 计忽略的重复项，不覆盖原值。
	Duplicated int64 `json:"duplicated"`
}

type Summary struct {
	// Requests 包括成功与失败的调用。
	Requests int64 `json:"requests"`
	// Errors 计显式标记失败的调用。
	Errors int64 `json:"errors"`
	// ErrorRate 为 errors/requests；无请求时为零。
	ErrorRate float64 `json:"error_rate"`
	// TotalTokens 不重复累加单列的 reasoning。
	TotalTokens float64 `json:"total_tokens"`
	// InputTokens 汇总未命中缓存的输入。
	InputTokens float64 `json:"input_tokens"`
	// OutputTokens 已包含提供方计入的 reasoning。
	OutputTokens float64 `json:"output_tokens"`
	// CacheReadTokens 汇总缓存读取。
	CacheReadTokens float64 `json:"cache_read_tokens"`
	// CacheWriteTokens 汇总缓存写入。
	CacheWriteTokens float64 `json:"cache_write_tokens"`
	// ReasoningTokens 单独展示，不再加入 TotalTokens。
	ReasoningTokens float64 `json:"reasoning_tokens"`
	// CacheRate 为缓存读取占全部输入及缓存 token 的比率；零分母为零。
	CacheRate float64 `json:"cache_rate"`
	// APICostEstimate 汇总美元 API 等价估算，不是订阅账单。
	APICostEstimate float64 `json:"api_cost_estimate"`
	// AvgDurationMS 忽略缺测值，但计入实测零值。
	AvgDurationMS float64 `json:"avg_duration_ms"`
	// AvgTTFTMS 忽略缺测值，但计入实测零值。
	AvgTTFTMS float64 `json:"avg_ttft_ms"`
	// AvgTokensPerSecond 平均单次 output/(duration-TTFT)，排除失败与缺测调用。
	AvgTokensPerSecond float64 `json:"avg_tokens_per_second"`
}

type ModelUsage struct {
	// Provider 与 Model 共同组成聚合键。
	Provider string `json:"provider"`
	// Model 位于相邻 Provider 指定的命名空间。
	Model string `json:"model"`
	// Requests 包括失败调用。
	Requests int64 `json:"requests"`
	// Errors 计显式标记失败的调用。
	Errors int64 `json:"errors"`
	// TotalTokens 不重复累加 reasoning。
	TotalTokens float64 `json:"total_tokens"`
	// InputTokens 汇总未命中缓存的输入。
	InputTokens float64 `json:"input_tokens"`
	// OutputTokens 已包含提供方计入的 reasoning。
	OutputTokens float64 `json:"output_tokens"`
	// CacheReadTokens 汇总缓存读取。
	CacheReadTokens float64 `json:"cache_read_tokens"`
	// CacheWriteTokens 汇总缓存写入。
	CacheWriteTokens float64 `json:"cache_write_tokens"`
	// ReasoningTokens 仅供单列展示，不再加入总量。
	ReasoningTokens float64 `json:"reasoning_tokens"`
	// CacheRate 与 Summary 使用相同输入及缓存分母。
	CacheRate float64 `json:"cache_rate"`
	// Cost 是美元 API 等价估算，不是订阅账单。
	Cost float64 `json:"cost"`
	// AvgTokensPerSecond 排除失败、缺测及非正生成间隔。
	AvgTokensPerSecond float64 `json:"avg_tokens_per_second"`
	// AvgTTFTMS 只平均已记录值，包含实测零值。
	AvgTTFTMS float64 `json:"avg_ttft_ms"`
}

type Point struct {
	// Timestamp 是自然时间桶的 UTC 起点。
	Timestamp time.Time `json:"timestamp"`
	// Requests 包括失败调用；空桶为零。
	Requests int64 `json:"requests"`
	// Errors 计本桶的失败调用。
	Errors int64 `json:"errors"`
	// TotalTokens 为 input+output+cache_read+cache_write。
	TotalTokens float64 `json:"total_tokens"`
	// APICostEstimate 是本桶美元 API 等价估算之和。
	APICostEstimate float64 `json:"api_cost_estimate"`
}
