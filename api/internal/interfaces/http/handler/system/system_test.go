// Package system 提供 system 监控模块的 HTTP handler 测试。
//
// handler 依赖 *appsystem.Service（具体结构体），测试构造真实 Service 注入
// 手写的 MetricCollector stub（db/redis 为 nil → 依赖探活降级为 disconnected），
// 仅断言 HTTP 层。
//
// 注：当前 handler 仅有 GetSnapshot / GetHistory 两个方法（任务描述中的 GetHealth
// 在本 handler 中并不存在）。
package system

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appsystem "blog-api/internal/application/system"
)

// stubMetricCollector 手写 stub，实现 appsystem.MetricCollector。
type stubMetricCollector struct {
	snap *appsystem.Snapshot
	err  error
}

func (c *stubMetricCollector) Collect() (*appsystem.Snapshot, error) {
	return c.snap, c.err
}

// 编译期断言。
var _ appsystem.MetricCollector = (*stubMetricCollector)(nil)

// TestGetSnapshot_Success collector 返回快照 → 200；db/redis 为 nil 时
// 依赖探活降级（Postgres/Redis disconnected）而不报错。
func TestGetSnapshot_Success(t *testing.T) {
	collector := &stubMetricCollector{snap: &appsystem.Snapshot{
		Host: appsystem.HostInfo{Hostname: "test-host", OS: "linux"},
		CPU:  appsystem.CPUInfo{UsagePercent: 12.3, Cores: 4},
	}}
	// db=nil, rdb=nil → checkDependencies 走 disconnected 分支不报错
	h := NewHandler(appsystem.NewService(nil, nil, collector))

	req := httptest.NewRequest(http.MethodGet, "/admin/system/snapshot", nil)
	rec := httptest.NewRecorder()
	h.GetSnapshot(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var env struct {
		Data *appsystem.Snapshot `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Equal(t, "test-host", env.Data.Host.Hostname)
	// nil 依赖 → 两者均 disconnected
	assert.False(t, env.Data.Dependencies.Postgres.Connected)
	assert.False(t, env.Data.Dependencies.Redis.Connected)
}

// TestGetSnapshot_CollectError_Returns500 collector 返回错误 → service 包装为
// 领域 INTERNAL 错误 → RespondError 映射为 500。
func TestGetSnapshot_CollectError_Returns500(t *testing.T) {
	collector := &stubMetricCollector{err: assertNotReached("采集失败")}
	h := NewHandler(appsystem.NewService(nil, nil, collector))

	req := httptest.NewRequest(http.MethodGet, "/admin/system/snapshot", nil)
	rec := httptest.NewRecorder()
	h.GetSnapshot(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "INTERNAL_ERROR")
}

// TestGetHistory_EmptyWithNilRedis rdb=nil → 返回空采样点数组，仍 200。
func TestGetHistory_EmptyWithNilRedis(t *testing.T) {
	collector := &stubMetricCollector{}
	h := NewHandler(appsystem.NewService(nil, nil, collector))

	req := httptest.NewRequest(http.MethodGet, "/admin/system/history", nil)
	rec := httptest.NewRecorder()
	h.GetHistory(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var env struct {
		Data *appsystem.HistoryResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &env))
	require.NotNil(t, env.Data)
	assert.Equal(t, 30, env.Data.Interval)
	assert.Empty(t, env.Data.Points)
}

// assertNotReached 返回一个总是携带给定消息的 error（供 stub 用）。
func assertNotReached(msg string) error { return &simpleError{msg: msg} }

type simpleError struct{ msg string }

func (e *simpleError) Error() string { return e.msg }
