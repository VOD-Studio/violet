package handler

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/service"
)

// extractUserIdentity 提取用户身份（从 JWT 或 IP）
// 返回用户 ID（如果已登录）和 IP 哈希（如果未登录）
func extractUserIdentity(r *http.Request) (*uuid.UUID, string) {
	// 1. 尝试从上下文获取用户 ID（由 Auth 中间件设置）
	if userIDValue := r.Context().Value("user_id"); userIDValue != nil {
		if userIDStr, ok := userIDValue.(string); ok {
			if userID, err := uuid.Parse(userIDStr); err == nil {
				log.Debug().Str("user_id", userID.String()).Msg("已登录用户")
				return &userID, ""
			}
		}
	}

	// 2. 未登录，使用 IP 哈希
	ip := getClientIP(r)
	ipHash := service.HashIPAddress(ip)
	log.Debug().Str("ip_hash", ipHash[:16]+"...").Msg("匿名用户")
	return nil, ipHash
}

// getClientIP 获取客户端真实 IP 地址
func getClientIP(r *http.Request) string {
	// 优先从 X-Forwarded-For 获取（代理/负载均衡器设置）
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// 取第一个 IP（原始客户端）
		return forwarded
	}
	// 其次从 X-Real-IP 获取
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}
	// 最后使用 RemoteAddr
	return r.RemoteAddr
}
