package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestLogger_PreservesFlusher 防回归：Logger 中间件包装的 ResponseWriter
// 必须仍满足 http.Flusher，否则下游 SSE 端点（如 code-runner/stream）的
// w.(http.Flusher) 断言会失败并返回 500。
func TestLogger_PreservesFlusher(t *testing.T) {
	var sawFlusher bool
	h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, ok := w.(http.Flusher)
		sawFlusher = ok
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	assert.True(t, sawFlusher, "经过 Logger 包装后 ResponseWriter 仍应满足 http.Flusher")
}

// TestLogger_CapturesStatusCode 校验 Logger 仍正确捕获下游写入的状态码。
func TestLogger_CapturesStatusCode(t *testing.T) {
	for _, tc := range []struct {
		name string
		code int
	}{
		{"200", http.StatusOK},
		{"404", http.StatusNotFound},
		{"500", http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.code)
			}))

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			assert.Equal(t, tc.code, rec.Code)
		})
	}
}

// TestResponseWriter_Flush_DelegatesToUnderlying 校验 Flush 转发到底层 Flusher；
// 底层不实现 Flusher 时不 panic（静默跳过）。
func TestResponseWriter_Flush_DelegatesToUnderlying(t *testing.T) {
	t.Run("底层实现 Flusher 时转发", func(t *testing.T) {
		rec := httptest.NewRecorder()
		var w http.ResponseWriter = &responseWriter{ResponseWriter: rec}
		f, ok := w.(http.Flusher)
		assert.True(t, ok)

		// 不应 panic，且底层 recorder 的 Flushed 被置位
		assert.NotPanics(t, func() { f.Flush() })
		assert.True(t, rec.Flushed)
	})

	t.Run("底层不实现 Flusher 时不 panic", func(t *testing.T) {
		var w http.ResponseWriter = &responseWriter{ResponseWriter: nilFlusherlessWriter{}}
		f, ok := w.(http.Flusher)
		assert.True(t, ok)
		assert.NotPanics(t, func() { f.Flush() })
	})
}

// nilFlusherlessWriter 一个既不是 Flusher、也不写任何东西的最小 ResponseWriter，
// 仅用于覆盖 Flush 转发的「底层不支持」分支。
type nilFlusherlessWriter struct{}

func (nilFlusherlessWriter) Header() http.Header              { return http.Header{} }
func (nilFlusherlessWriter) Write([]byte) (int, error)         { return 0, nil }
func (nilFlusherlessWriter) WriteHeader(int)                   {}
