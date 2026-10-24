package ompusage

import "time"

// UsageEvent 仅保留用量元数据，不含提示词、路径或会话正文。
type UsageEvent struct {
	// UserID 只能来自宿主认证身份，不接受客户端指定。
	UserID string
	// ClientEventID 是用户范围内稳定、不透明的幂等键。
	ClientEventID string
	// Provider 标识模型提供方。
	Provider string
	// Model 标识提供方下的模型。
	Model string
	// InputTokens 计未命中缓存的输入 token。
	InputTokens int64
	// OutputTokens 已包含提供方统计的 reasoning token。
	OutputTokens int64
	// CacheReadTokens 计从缓存读取的输入 token。
	CacheReadTokens int64
	// CacheWriteTokens 计写入缓存的输入 token。
	CacheWriteTokens int64
	// ReasoningTokens 是输出的子集，不再次计入总量。
	ReasoningTokens int64
	// CostTotal 是美元 API 等价估算，不是订阅账单。
	CostTotal float64
	// StopReason 是结束原因元数据，不是生成的正文。
	StopReason string
	// IsError 标记失败的模型调用。
	IsError bool
	// DurationMS 是总耗时毫秒；nil 表示未测量。
	DurationMS *float64
	// TTFTMS 是首 token 延迟毫秒；nil 表示未测量。
	TTFTMS *float64
	// IsSubagent 区分子代理调用，但不携带代理身份。
	IsSubagent bool
	// OMPVersion 标识上报运行时版本。
	OMPVersion string
	// OccurredAt 是客户端记录的 UTC 完成时间。
	OccurredAt time.Time
	// CreatedAt 是服务端记录的摄取时间。
	CreatedAt time.Time
}
