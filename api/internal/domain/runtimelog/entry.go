package runtimelog

import (
	"context"
	"time"
)

type Entry struct {
	// ID 持久化接收顺序；不按日志发生时间分页。
	ID int64 `json:"id,string"`
	// OccurredAt 日志入口报告的发生时间。
	OccurredAt time.Time `json:"occurred_at"`
	// ReceivedAt 当前进程接收到日志的时间。
	ReceivedAt time.Time `json:"received_at"`
	// Level 日志入口实际放行的级别，小写 zerolog 级别名。
	Level string `json:"level"`
	// Source 日志入口声明的来源，不从消息内容猜测业务模块。
	Source string `json:"source"`
	// Message 脱敏后的消息，不包含任意结构化字段。
	Message string `json:"message"`
	// RequestID 已存在的请求关联标识；未提供时为空。
	RequestID string `json:"request_id,omitempty"`
	// TraceID 已存在的追踪标识；未接入 tracing 时为空。
	TraceID string `json:"trace_id,omitempty"`
}

type Filter struct {
	// Levels 允许的日志级别；空列表表示不限。
	Levels []string
	// Source 精确匹配日志来源；空串表示不限。
	Source string
	// Keyword 在已脱敏消息中进行字面量搜索。
	Keyword string
	// RequestID 精确匹配请求标识。
	RequestID string
	// TraceID 精确匹配追踪标识。
	TraceID string
	// From 发生时间下界，包含端点；零值表示不限。
	From time.Time
	// Until 发生时间上界，不包含端点；零值表示不限。
	Until time.Time
	// Before 接收顺序上界，不包含端点；用于向前翻页。
	Before int64
	// After 接收顺序下界，不包含端点；用于实时续读。
	After int64
	// Through 本次已观察到的接收顺序上界，包含端点；零值表示不限。
	Through int64
	// Ascending 按接收顺序正向读取；历史页默认倒序。
	Ascending bool
	// Limit 本次最多返回的记录数，由应用层限制。
	Limit int
}

type Bounds struct {
	// Oldest 当前仍可读取的最早接收序号；空库为零。
	Oldest int64
	// Newest 当前已持久化的最晚接收序号；空库为零。
	Newest int64
}

type Sink interface {
	Append(context.Context, []Entry) error
}

type Store interface {
	Sink
	Read(context.Context, Filter) ([]Entry, error)
	Bounds(context.Context) (Bounds, error)
}
