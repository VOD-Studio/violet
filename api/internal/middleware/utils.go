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

// SetTrustedProxies 更新受信代理列表。启动时由部署配置注入一次；
// 后台保存安全策略后经 settings 回调热刷新。
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
			if ip := net.ParseIP(c); ip != nil {
				if ip.To4() != nil {
					c += "/32"
				} else {
					c += "/128"
				}
			}
		}
		if _, ipnet, err := net.ParseCIDR(c); err == nil {
			e.nets = append(e.nets, ipnet)
		}
	}
	return e
}

// isTrusted 判断 remoteAddr（host:port 或裸 IP）是否命中受信代理网段
func (e *ipExtr) isTrusted(remoteAddr string) bool {
	return e.isTrustedIP(hostOnly(remoteAddr))
}

// isTrustedIP 判断已解析 IP 字符串是否命中受信代理网段
func (e *ipExtr) isTrustedIP(ip string) bool {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return false
	}
	for _, n := range e.nets {
		if n.Contains(parsed) {
			return true
		}
	}
	return false
}

// hostOnly 去掉 RemoteAddr 的临时端口；无法拆分时原样返回。
func hostOnly(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}

// parseValidIP 校验并返回合法 IP 字符串，非法输入返回空串。
func parseValidIP(raw string) string {
	raw = strings.TrimSpace(raw)
	if ip := net.ParseIP(raw); ip != nil {
		return raw
	}
	return ""
}


// getClientIP 获取客户端真实 IP 地址。
func getClientIP(r *http.Request) string {
	return GetClientIP(r)
}

// GetClientIP 导出版本，供 handler 层复用同一套受信代理感知逻辑。
//
// 仅当 RemoteAddr 命中受信代理列表时才采信转发头，否则一律使用 RemoteAddr，
// 避免客户端伪造转发头绕过限流。XFF 按标准从右往左剥离可信代理链：
// 最右侧不可信地址才是真实来访者，直接取最左一项会被客户端注入的伪造前缀欺骗。
func GetClientIP(r *http.Request) string {
	ipExtractorMu.RLock()
	extr := ipExtractor
	ipExtractorMu.RUnlock()

	host := hostOnly(r.RemoteAddr)
	if !extr.isTrustedIP(host) {
		return host
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if ip := extr.rightmostUntrusted(xff); ip != "" {
			return ip
		}
	}
	if realIP := parseValidIP(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}
	return host
}

// rightmostUntrusted 从 XFF 中从右往左剥离可信代理，返回最右侧不可信地址；
// 全部可信时返回最左一项（如内网健康检查）。任一段不是合法 IP 则整体放弃该头，
// 防止畸形注入被部分采信。
func (e *ipExtr) rightmostUntrusted(forwarded string) string {
	parts := strings.Split(forwarded, ",")
	ips := make([]string, 0, len(parts))
	for _, part := range parts {
		ip := parseValidIP(part)
		if ip == "" {
			return ""
		}
		ips = append(ips, ip)
	}
	if len(ips) == 0 {
		return ""
	}
	for i := len(ips) - 1; i >= 0; i-- {
		if !e.isTrustedIP(ips[i]) {
			return ips[i]
		}
	}
	return ips[0]
}

// getTokenPrefix 获取 token 前缀用于日志记录（不记录完整 token）
func getTokenPrefix(token string) string {
	if len(token) > 10 {
		return token[:10] + "..."
	}
	return "***"
}
