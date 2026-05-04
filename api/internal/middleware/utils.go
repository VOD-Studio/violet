// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import "net/http"

// getClientIP 获取客户端真实 IP 地址
// 优先从 X-Forwarded-For 和 X-Real-IP 头部获取
func getClientIP(r *http.Request) string {
	// 优先检查代理头
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// 取第一个 IP（原始客户端）
		if ip := extractFirstIP(forwarded); ip != "" {
			return ip
		}
	}

	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}

	// 回退到 RemoteAddr
	return r.RemoteAddr
}

// extractFirstIP 从 X-Forwarded-For 头部提取第一个 IP
// 格式通常为 "client, proxy1, proxy2"
func extractFirstIP(forwarded string) string {
	for i := 0; i < len(forwarded); i++ {
		if forwarded[i] == ',' {
			return forwarded[:i]
		}
	}
	return forwarded
}

// getTokenPrefix 获取 token 前缀用于日志记录（不记录完整 token）
func getTokenPrefix(token string) string {
	if len(token) > 10 {
		return token[:10] + "..."
	}
	return "***"
}
