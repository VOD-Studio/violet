// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net/http"
	"sync"
	"sync/atomic"

	"github.com/go-chi/cors"
	"github.com/rs/zerolog/log"
)

// CORSOption CORS 中间件的可选配置
type CORSOption func(*cors.Options)

// WithCSRFHeader 在 AllowedHeaders 中追加 CSRF 自定义请求头
//
// double-submit CSRF 防护要求前端在请求中携带 X-CSRF-Token，
// 浏览器预检（OPTIONS）会校验该 header 是否在 AllowedHeaders 中，缺失会导致请求被拒。
func WithCSRFHeader(header string) CORSOption {
	return func(o *cors.Options) {
		o.AllowedHeaders = append(o.AllowedHeaders, header)
	}
}

// corsRuntime 支持热更新允许来源的 CORS 运行时。override 非空时覆盖部署基线
// （安全组 trusted_origins 生效路径），空时回落基线。
type corsRuntime struct {
	mu       sync.RWMutex
	base     []string
	opts     cors.Options
	active   atomic.Pointer[cors.Cors]
	override []string
}

var globalCORS = &corsRuntime{}

// NewCORS 创建跨域资源共享中间件
//
// allowedOrigins 必须是显式来源列表（禁止使用 "*"，因为 AllowCredentials=true 时
// go-chi/cors 会拒绝通配符，浏览器也会拒绝携带 Cookie）。
// opts 用于追加自定义 header（如 CSRF）。
// 来源可经 SetCORSAllowedOrigins 热更新（安全组生效时），空列表恢复部署基线。
func NewCORS(allowedOrigins []string, opts ...CORSOption) func(http.Handler) http.Handler {
	options := cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"X-Total-Count"},
		AllowCredentials: true, // 必须 true，Cookie 才能跨域携带
		MaxAge:           300,
	}
	for _, opt := range opts {
		opt(&options)
	}
	globalCORS.mu.Lock()
	globalCORS.base = allowedOrigins
	globalCORS.opts = options
	override := globalCORS.override
	globalCORS.mu.Unlock()
	// 启动装配晚于 settings.Initialize 的热应用回调：若数据库覆盖已刷入
	// origins，此处不得用部署基线把它覆盖回去（trusted_origins 持久化生效）。
	if len(override) > 0 {
		globalCORS.rebuild(override)
	} else {
		globalCORS.rebuild(allowedOrigins)
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && r.Method == http.MethodOptions {
				log.Debug().
					Str("origin", origin).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("CORS 预检请求")
			}
			handler := globalCORS.active.Load()
			handler.Handler(next).ServeHTTP(w, r)
		})
	}
}

// SetCORSAllowedOrigins 热更新 CORS 允许来源。origins 为空时恢复部署基线。
func SetCORSAllowedOrigins(origins []string) {
	globalCORS.mu.Lock()
	defer globalCORS.mu.Unlock()
	globalCORS.override = origins
	if len(origins) == 0 {
		origins = globalCORS.base
	}
	globalCORS.rebuild(origins)
}

func (c *corsRuntime) rebuild(origins []string) {
	options := c.opts
	options.AllowedOrigins = origins
	c.active.Store(cors.New(options))
}

// CORS 默认 CORS 中间件（向后兼容）
//
// Deprecated: 改用 NewCORS(allowedOrigins) 以使用配置驱动的来源列表。
// 保留是为了不破坏现有测试与未迁移的调用点。
func CORS(next http.Handler) http.Handler {
	return NewCORS([]string{
		"http://localhost:3000",
		"http://localhost:5173",
	})(next)
}
