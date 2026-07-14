// Package observability 提供 mimo-music 的可观测性基础设施。
//
// 包含结构化日志（slog）、链路追踪（OTel 最小初始化）、敏感字段脱敏、
// 统一字段名常量、高频日志采样。所有日志只写 stdout，不落盘。
package observability

// 字段名常量，OTel semantic conventions 风格。
//
// 所有日志和指标的属性键统一用这些常量，避免拼写不一致
// （user_id vs userId vs uid）导致日志检索困难。
const (
	// FieldPlatform 是音乐平台标识（netease / huawei）。
	FieldPlatform = "platform"

	// FieldUserID 是脱敏后的用户标识。
	FieldUserID = "user_id"

	// FieldRequestID 是 HTTP 请求级 ID，由中间件生成。
	FieldRequestID = "request_id"

	// FieldTaskID 是 worker 任务级 ID。
	FieldTaskID = "task_id"

	// FieldTraceID 是 OTel 自动注入的链路追踪 ID。
	FieldTraceID = "trace_id"

	// FieldSpanID 是 OTel span ID。
	FieldSpanID = "span_id"

	// FieldUpstreamLatencyMS 是调用上游（网易云）的耗时，单位毫秒。
	FieldUpstreamLatencyMS = "upstream_latency_ms"

	// FieldCacheHit 表示是否命中缓存（true / false）。
	FieldCacheHit = "cache_hit"

	// FieldErrorCode 是统一错误码，对应 errors 包定义的类型。
	FieldErrorCode = "error_code"

	// FieldMethod 是 HTTP 请求方法。
	FieldMethod = "method"

	// FieldPath 是 HTTP 请求路径。
	FieldPath = "path"

	// FieldStatus 是 HTTP 响应状态码。
	FieldStatus = "status"

	// FieldDurationMS 是请求处理耗时，单位毫秒。
	FieldDurationMS = "duration_ms"

	// FieldCookieHash 是 Cookie 的 SHA256 前 8 位，用于排障关联但不泄露内容。
	FieldCookieHash = "cookie_hash"

	// FieldPhoneHash 是手机号的 SHA256 前 8 位。
	FieldPhoneHash = "phone_hash"
)
