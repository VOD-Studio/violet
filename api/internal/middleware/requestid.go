package middleware

import (
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

// RequestIDHeader 是 RequestID 写入响应头与读取上游透传时使用的头名
const RequestIDHeader = "X-Request-Id"

// RequestID 必须位于日志和异常恢复中间件外层，复用 chi 的生成与透传规则。
func RequestID(next http.Handler) http.Handler {
	return middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := middleware.GetReqID(r.Context())
		w.Header().Set(RequestIDHeader, requestID)
		logger := log.With().Str("request_id", requestID).Logger()
		next.ServeHTTP(w, r.WithContext(logger.WithContext(r.Context())))
	}))
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
