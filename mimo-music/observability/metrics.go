// Package observability 提供 mimo-music 的可观测性基础设施。
//
// metrics.go 定义 Prometheus 指标，供 server middleware、service 层、worker
// 统一埋点。所有指标以 mimomusic_ 为前缀，遵循 Prometheus 命名规范。
package observability

import "github.com/prometheus/client_golang/prometheus"

// Metrics 持有 mimo-music 全量 Prometheus 指标。
//
// server middleware、service 层、worker 各自在对应位置调用方法递增指标。
// 通过依赖注入传入各组件，避免全局变量散落。
type Metrics struct {
	// RequestTotal 是 HTTP 请求总数（按 method / path / status 标签）。
	RequestTotal *prometheus.CounterVec

	// RequestDuration 是 HTTP 请求处理耗时（秒）。
	RequestDuration *prometheus.HistogramVec

	// CacheHits 是缓存命中次数。
	CacheHits prometheus.Counter

	// CacheMisses 是缓存未命中次数。
	CacheMisses prometheus.Counter

	// UpstreamErrors 是上游调用失败次数。
	UpstreamErrors prometheus.Counter

	// UpstreamLatency 是上游调用耗时（秒）。
	UpstreamLatency *prometheus.HistogramVec

	// CookieHealthStatus 是 Cookie 健康检查结果（1=可用，0=失效）。
	CookieHealthStatus *prometheus.GaugeVec
}

// NewMetrics 创建并注册全量指标到默认 registry。
func NewMetrics() *Metrics {
	return newMetrics(true, nil)
}

// RecordCacheHit 递增缓存命中计数。
func (m *Metrics) RecordCacheHit() {
	m.CacheHits.Inc()
}

// RecordCacheMiss 递增缓存未命中计数。
func (m *Metrics) RecordCacheMiss() {
	m.CacheMisses.Inc()
}

// RecordUpstreamError 递增上游错误计数。
func (m *Metrics) RecordUpstreamError() {
	m.UpstreamErrors.Inc()
}

// ObserveUpstreamLatency 记录上游调用耗时。
func (m *Metrics) ObserveUpstreamLatency(operation string, seconds float64) {
	m.UpstreamLatency.WithLabelValues(operation).Observe(seconds)
}

// SetCookieHealth 更新 Cookie 健康状态。
func (m *Metrics) SetCookieHealth(userID string, healthy bool) {
	val := 0.0
	if healthy {
		val = 1.0
	}
	m.CookieHealthStatus.WithLabelValues(userID).Set(val)
}

// newMetrics 构造 Metrics 并可选注册到指定 registry。
func newMetrics(register bool, reg prometheus.Registerer) *Metrics {
	m := &Metrics{
		RequestTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "mimomusic_request_total",
			Help: "HTTP 请求总数",
		}, []string{"method", "path", "status"}),
		RequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mimomusic_request_duration_seconds",
			Help:    "HTTP 请求处理耗时",
			Buckets: prometheus.DefBuckets,
		}, []string{"method", "path"}),
		CacheHits: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "mimomusic_cache_hits_total",
			Help: "缓存命中次数",
		}),
		CacheMisses: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "mimomusic_cache_misses_total",
			Help: "缓存未命中次数",
		}),
		UpstreamErrors: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "mimomusic_upstream_errors_total",
			Help: "上游调用失败次数",
		}),
		UpstreamLatency: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "mimomusic_upstream_latency_seconds",
			Help:    "上游调用耗时",
			Buckets: prometheus.DefBuckets,
		}, []string{"operation"}),
		CookieHealthStatus: prometheus.NewGaugeVec(prometheus.GaugeOpts{
			Name: "mimomusic_cookie_health_status",
			Help: "Cookie 健康状态（1=可用，0=失效）",
		}, []string{"user_id"}),
	}
	if register {
		prometheus.MustRegister(
			m.RequestTotal,
			m.RequestDuration,
			m.CacheHits,
			m.CacheMisses,
			m.UpstreamErrors,
			m.UpstreamLatency,
			m.CookieHealthStatus,
		)
	}
	return m
}

// NewTestMetrics 创建不注册到全局 registry 的 Metrics，供测试用。
//
// 避免多次注册同一指标导致 panic。
func NewTestMetrics() *Metrics {
	return newMetrics(false, nil)
}
