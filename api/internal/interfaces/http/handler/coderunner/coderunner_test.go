// Package coderunner 提供 code-runner 模块的 HTTP handler 测试。
//
// 优先覆盖参数校验路径（body 解析 / language 缺失），这些路径在调用 svc 前
// 即返回 400，故 handler 可持 nil svc（不触碰 service 即可断言 HTTP 层）。
package coderunner

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// newNilSvcHandler 构造 svc=nil 的 handler，仅用于 400 校验路径
// （这些路径在 svc 被解引用前即返回）。
func newNilSvcHandler() *Handler { return &Handler{} }

// TestRun_EmptyBody_Returns400 空 body → json.Decode EOF → 400。
func TestRun_EmptyBody_Returns400(t *testing.T) {
	h := newNilSvcHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/code-runner/run", strings.NewReader(""))
	rec := httptest.NewRecorder()
	h.Run(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestRun_InvalidJSON_Returns400 非法 JSON → json.SyntaxError → 400。
func TestRun_InvalidJSON_Returns400(t *testing.T) {
	h := newNilSvcHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/code-runner/run", strings.NewReader("{bad json"))
	rec := httptest.NewRecorder()
	h.Run(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestRun_MissingLanguage_Returns400 合法 JSON 但 language 为空 → 400。
func TestRun_MissingLanguage_Returns400(t *testing.T) {
	h := newNilSvcHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/code-runner/run",
		strings.NewReader(`{"source":"print(1)"}`))
	rec := httptest.NewRecorder()
	h.Run(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestRunStream_EmptyBody_Returns400 RunStream 与 Run 共用 decodeRunRequest，
// 空 body 同样 → 400。
func TestRunStream_EmptyBody_Returns400(t *testing.T) {
	h := newNilSvcHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/code-runner/run/stream", strings.NewReader(""))
	rec := httptest.NewRecorder()
	h.RunStream(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}

// TestGetTask_EmptyID_Returns400 未注入 id 路径参数 → 400（在 svc 前返回）。
func TestGetTask_EmptyID_Returns400(t *testing.T) {
	h := newNilSvcHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/code-runner/tasks/", nil)
	rec := httptest.NewRecorder()
	h.GetTask(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "BAD_REQUEST")
}
