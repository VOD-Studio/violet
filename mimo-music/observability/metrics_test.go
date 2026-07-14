package observability_test

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/VOD-Studio/mimo-music/observability"
)

// TestMetrics_CacheHitMiss 验证缓存命中/未命中计数器递增。
func TestMetrics_CacheHitMiss(t *testing.T) {
	m := observability.NewTestMetrics()

	if count := testutil.ToFloat64(m.CacheHits); count != 0 {
		t.Fatalf("初始 CacheHits = %v, want 0", count)
	}

	m.RecordCacheHit()
	m.RecordCacheHit()
	m.RecordCacheMiss()

	if count := testutil.ToFloat64(m.CacheHits); count != 2 {
		t.Errorf("CacheHits = %v, want 2", count)
	}
	if count := testutil.ToFloat64(m.CacheMisses); count != 1 {
		t.Errorf("CacheMisses = %v, want 1", count)
	}
}

// TestMetrics_UpstreamError 验证上游错误计数器递增。
func TestMetrics_UpstreamError(t *testing.T) {
	m := observability.NewTestMetrics()

	m.RecordUpstreamError()
	m.RecordUpstreamError()
	m.RecordUpstreamError()

	if count := testutil.ToFloat64(m.UpstreamErrors); count != 3 {
		t.Errorf("UpstreamErrors = %v, want 3", count)
	}
}

// TestMetrics_UpstreamLatency 验证上游延迟可观测。
func TestMetrics_UpstreamLatency(t *testing.T) {
	m := observability.NewTestMetrics()

	m.ObserveUpstreamLatency("playlist_detail", 0.5)

	count := testutil.CollectAndCount(m.UpstreamLatency)
	if count != 1 {
		t.Errorf("UpstreamLatency 标签数 = %d, want 1", count)
	}
}

// TestMetrics_CookieHealth 验证 Cookie 健康状态 gauge 更新。
func TestMetrics_CookieHealth(t *testing.T) {
	m := observability.NewTestMetrics()

	m.SetCookieHealth("user1", true)
	m.SetCookieHealth("user2", false)

	val1 := testutil.ToFloat64(m.CookieHealthStatus.WithLabelValues("user1"))
	if val1 != 1 {
		t.Errorf("user1 health = %v, want 1", val1)
	}
	val2 := testutil.ToFloat64(m.CookieHealthStatus.WithLabelValues("user2"))
	if val2 != 0 {
		t.Errorf("user2 health = %v, want 0", val2)
	}
}

// TestMetrics_RequestTotal 验证请求计数器带标签递增。
func TestMetrics_RequestTotal(t *testing.T) {
	m := observability.NewTestMetrics()

	m.RequestTotal.WithLabelValues("GET", "/health", "200").Inc()
	m.RequestTotal.WithLabelValues("GET", "/health", "200").Inc()
	m.RequestTotal.WithLabelValues("GET", "/playlists/1", "404").Inc()

	val := testutil.ToFloat64(m.RequestTotal.WithLabelValues("GET", "/health", "200"))
	if val != 2 {
		t.Errorf("GET /health 200 count = %v, want 2", val)
	}
	val404 := testutil.ToFloat64(m.RequestTotal.WithLabelValues("GET", "/playlists/1", "404"))
	if val404 != 1 {
		t.Errorf("GET /playlists/1 404 count = %v, want 1", val404)
	}
}
