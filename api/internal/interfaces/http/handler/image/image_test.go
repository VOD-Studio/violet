// Package image 提供 uploads 图片服务 handler 的测试。
//
// ServeImage 的路径安全检查（400）、参数解析（400）与无参数直传原文件路径
// （serveOriginal，走 http.ServeFile，不触碰 svc）均在 svc 解引用前完成，
// 故用 nil svc 即可覆盖。404 用真实临时目录（文件不存在）验证。
package image

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestServeImage_PathTraversal_Returns400 路径含 ".." → 拒绝 400。
// 用嵌入串（非真实穿越段）避免 net/http 路径归一化影响 substring 判定。
func TestServeImage_PathTraversal_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/foo..bar", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "非法路径")
}

// TestServeImage_NullByteInPath_Returns400 路径含 \0 → 拒绝 400。
// 用手工构造的 url.URL 注入控制字符（httptest.NewRequest 会拒绝解析含 \0 的 URL）。
func TestServeImage_NullByteInPath_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := &http.Request{Method: http.MethodGet, URL: &url.URL{Path: "/uploads/a\x00b"}}
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestServeImage_InvalidWidthParam_Returns400 无效的 w 参数 → parseParams 400。
func TestServeImage_InvalidWidthParam_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/img.png?w=abc", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "w 参数无效")
}

// TestServeImage_NotFound_Returns404 无参数直传：文件不存在 → http.ServeFile 404。
func TestServeImage_NotFound_Returns404(t *testing.T) {
	dir := t.TempDir()
	h := NewHandler(nil, dir, "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/missing.png", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

// TestServeImage_ServesOriginalFile_Returns200 无参数直传：文件存在 → 200，
// 响应体为文件内容（验证 serveOriginal 成功路径，全程不触碰 svc）。
func TestServeImage_ServesOriginalFile_Returns200(t *testing.T) {
	dir := t.TempDir()
	content := []byte("PNG-FAKE-BYTES")
	require.NoError(t, os.WriteFile(filepath.Join(dir, "logo.png"), content, 0o644))
	h := NewHandler(nil, dir, "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/logo.png", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, content, rec.Body.Bytes())
}
