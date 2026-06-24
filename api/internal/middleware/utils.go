// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
)

// ipExtractor 全局 IP 提取器（受信代理感知）。
// 由 main.go 在启动时通过 SetTrustedProxies 配置；未配置时一律使用 RemoteAddr。
var (
	ipExtractor = newIPExtractor(nil)
	// ipExtractorMu 保护 ipExtractor 的并发读写（SetTrustedProxies 写、getClientIP 读）。
	// 启动时单次写入后只读，RWMutex 仍保证初始化竞态安全。
	ipExtractorMu sync.RWMutex
)

// SetTrustedProxies 配置受信代理列表，必须在 HTTP 服务启动前调用一次。
func SetTrustedProxies(cidrs []string) {
	ipExtractorMu.Lock()
	defer ipExtractorMu.Unlock()
	ipExtractor = newIPExtractor(cidrs)
}

// ipExtr 提取器实现（不可变，构造后线程安全）
type ipExtr struct {
	nets []*net.IPNet
}

func newIPExtractor(cidrs []string) *ipExtr {
	e := &ipExtr{}
	for _, c := range cidrs {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		// 不带掩码的单 IP 视为 /32（v4）或 /128（v6）
		if !strings.Contains(c, "/") {
			c += "/32"
		}
		if _, ipnet, err := net.ParseCIDR(c); err == nil {
			e.nets = append(e.nets, ipnet)
		}
	}
	return e
}

// isTrusted 判断 ip 是否来自受信代理
func (e *ipExtr) isTrusted(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr // 没有端口
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	for _, n := range e.nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// getClientIP 获取客户端真实 IP 地址。
//
// 仅当 RemoteAddr 命中受信代理列表时，才信任 X-Forwarded-For / X-Real-IP；
// 否则一律使用 RemoteAddr，避免客户端伪造转发头绕过限流。
func getClientIP(r *http.Request) string {
	return GetClientIP(r)
}

// GetClientIP 导出版本，供 handler 层复用同一套受信代理感知逻辑。
func GetClientIP(r *http.Request) string {
	ipExtractorMu.RLock()
	extr := ipExtractor
	ipExtractorMu.RUnlock()

	if extr.isTrusted(r.RemoteAddr) {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			if ip := extractFirstIP(xff); ip != "" {
				return ip
			}
		}
		if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
			return realIP
		}
	}
	return r.RemoteAddr
}

// extractFirstIP 从 X-Forwarded-For 头部提取第一个 IP
// 格式通常为 "client, proxy1, proxy2"
func extractFirstIP(forwarded string) string {
	for i := 0; i < len(forwarded); i++ {
		if forwarded[i] == ',' {
			return strings.TrimSpace(forwarded[:i])
		}
	}
	return strings.TrimSpace(forwarded)
}

// getTokenPrefix 获取 token 前缀用于日志记录（不记录完整 token）
func getTokenPrefix(token string) string {
	if len(token) > 10 {
		return token[:10] + "..."
	}
	return "***"
}
