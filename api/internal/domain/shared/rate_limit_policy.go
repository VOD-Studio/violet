package shared

// MaxRateLimitWindowSeconds 同时约束可配置窗口与 Redis 获准请求历史的保留边界。
const MaxRateLimitWindowSeconds int64 = 86400

type RateLimitPolicy struct {
	// Enabled 关闭时不判定、不计数，但不会清除已获准请求历史。
	Enabled bool `json:"enabled"`
	// WindowSeconds 是主滑动窗口，范围为 1 至 MaxRateLimitWindowSeconds。
	WindowSeconds int64 `json:"window_seconds"`
	// MaxRequests 是主窗口内获准请求上限，不能用零表示关闭。
	MaxRequests int64 `json:"max_requests"`
	// BurstRequests 为独立的一秒滑动窗口上限，零表示关闭。
	BurstRequests int64 `json:"burst_requests"`
	// DailyQuota 按 UTC 自然日累计，零表示关闭。
	DailyQuota int64 `json:"daily_quota"`
	// FailureMode 仅接受 allow 或 deny，控制 Redis 不可用时的准入。
	FailureMode string `json:"failure_mode"`
}

// RateLimitSnapshot 将整组规则与版本绑定，消费者只能按值读取规则。
type RateLimitSnapshot struct {
	// rules 是发布后不可再变的规则表，不向消费者暴露可写引用。
	rules   map[string]RateLimitPolicy
	// version 标识整组规则的同一次发布。
	version uint64
}

// NewRateLimitSnapshot 借用已冻结的规则表；提供方发布后不得再修改该表。
func NewRateLimitSnapshot(rules map[string]RateLimitPolicy, version uint64) RateLimitSnapshot {
	return RateLimitSnapshot{rules: rules, version: version}
}

func (s RateLimitSnapshot) Lookup(id string) (RateLimitPolicy, bool) {
	policy, ok := s.rules[id]
	return policy, ok
}

func (s RateLimitSnapshot) Version() uint64 {
	return s.version
}
