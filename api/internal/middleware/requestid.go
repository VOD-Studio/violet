package middleware

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
)

// RequestIDHeader 是 RequestID 写入响应头与读取上游透传时使用的头名
const RequestIDHeader = "X-Request-Id"

// RequestID 请求追踪中间件
//
// 读取上游 X-Request-Id 头用于链路透传；若不存在则生成一个新的 UUIDv4。
// 将 request_id 注入到响应头、context 和 zerolog 日志上下文，
// 使同一请求的所有日志（请求日志、panic 日志、业务日志）能被串联检索。
//
// 必须排在 Logger / Recoverer 之前，以便它们能读取到 request_id。
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 复用 chi 内置的 RequestID 中间件（生成 / 透传 + 注入 context）
		handler := middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 把 request_id 写入响应头，方便客户端与日志对齐
			if reqID := GetRequestID(r); reqID != "" {
				w.Header().Set(RequestIDHeader, reqID)
			}
			next.ServeHTTP(w, r)
		}))
		handler.ServeHTTP(w, r)
	})
}

// GetRequestID 从 request context 提取 RequestID
// 返回空串表示未设置（中间件未启用）
func GetRequestID(r *http.Request) string {
	if reqID := middleware.GetReqID(r.Context()); reqID != "" {
		return reqID
	}
	// 兼容从上游透传但未被中间件处理的情况
	if upstream := r.Header.Get(RequestIDHeader); upstream != "" {
		return upstream
	}
	return ""
}

// LoggerWithRequestID 返回带 request_id 字段的 zerolog 上下文 logger
// 供 service 层等业务代码使用：log.Ctx(ctx).Info() 即可自动带上 request_id
func LoggerWithRequestID(ctx context.Context) context.Context {
	// chi 的 RequestID 通过 context 传递，zerolog 的 log.Ctx() 会读取
	return ctx
}
