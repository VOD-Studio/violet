// Package ssrf 提供 SSRF（Server-Side Request Forgery）防护公共组件。
//
// 给所有"抓取外部 URL"的能力（scrape_url tool、订阅抓取、admin ImportURL）
// 提供统一的安全预检层：协议白名单 + 私网地址过滤 + DNS 重绑定防护。
//
// 设计为纯函数，输入 URL/host/IP → 是否拒绝 + 原因。不夹带任何业务实体逻辑
// （AGENTS.md 架构耦合约束：通用基础设施不夹带具体业务实体逻辑）。
package ssrf

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"
)

// MaxBodyBytes 抓取响应体的默认上限（10 MB）。
// 防止恶意/巨型响应打爆内存。HTML 文章正文极少超过 1MB，10MB 留足余量。
const MaxBodyBytes int64 = 10 * 1024 * 1024

// LimitBody 包装响应体为有界 reader，超过 max 字节返回错误（而非 io.LimitReader 的静默截断）。
//
// 用于所有抓取外部 URL 的场景（scrape_url、订阅抓取、admin ImportURL、robots.txt），
// 防止恶意源站返回超大响应导致 OOM。基于 http.MaxBytesReader 实现（到上限返回
// *http.MaxBytesError，调用方按错误处理）。
func LimitBody(body io.ReadCloser, max int64) io.ReadCloser {
	// http.MaxBytesReader 第一个参数 ResponseWriter 可为 nil（仅在不触发 WriteHeader
	// 的纯读取场景，正是我们的用法）
	return http.MaxBytesReader(nil, body, max)
}

// ValidateURL 做 URL 文本层预检：协议白名单（仅 http/https）+ host 非空。
// 返回解析后的 *url.URL 供调用方继续构造请求。
//
// 这是 SSRF 防护的第一道闸门，在发起任何网络请求前调用。
// DNS 解析后的 IP 校验（防 DNS 重绑定）由 CheckHost 在实际连接前完成。
func ValidateURL(rawURL string) (*url.URL, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("无效的 URL: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("仅允许 http/https 协议，得到 %q", parsed.Scheme)
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("URL 缺少 host")
	}
	return parsed, nil
}

// IsPrivateIP 判定 IP 是否属于私网/保留地址段，应被 SSRF 防护拒绝。
//
// 覆盖：
//   - IPv4 loopback 127/8、私网 10/8、172.16/12、192.168/16
//   - IPv4 link-local 169.254/16（含云元数据服务 169.254.169.254）
//   - IPv4 CGNAT 100.64.0.0/10（RFC 6598 共享地址空间）
//   - IPv4 0/8（本机网络）、多播 224/4、保留 240/4
//   - IPv6 loopback ::1、link-local fe80::/10、ULA fc00::/7、多播 ff00::/8
//   - 所有未指定/全零地址
//
// 公网 IP（如 8.8.8.8、93.184.216.34）返回 false。
func IsPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsUnspecified() || ip.IsLoopback() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() ||
		ip.IsMulticast() || ip.IsPrivate() {
		return true
	}
	// net.IP.IsPrivate 已覆盖 IPv4 10/8/172.16/12/192.168/16 与 IPv6 fc00::/7，
	// 但不覆盖 IPv4 0/8、224/4 多播起始、240/4 保留——下面补齐。
	if v4 := ip.To4(); v4 != nil {
		switch {
		case v4[0] == 0: // 0.0.0.0/8 本机网络
			return true
		case v4[0] == 127: // 127/8 loopback（IsLoopback 已覆盖，保险）
			return true
		case v4[0] == 169 && v4[1] == 254: // 169.254/16 link-local
			return true
		case v4[0] == 100 && v4[1] >= 64 && v4[1] <= 127: // 100.64.0.0/10 CGNAT（RFC 6598）
			return true
		case v4[0] >= 240: // 240/4 保留（E 类）
			return true
		}
	}
	return false
}

// lookupHostFn 是 host → IP 列表的解析函数类型。
// 抽成参数便于注入：生产用 net.DefaultResolver.LookupIP，测试用假函数模拟 DNS 重绑定。
type lookupHostFn func(host string) ([]net.IP, error)

// defaultLookup 使用系统默认 DNS 解析。CheckHost 的零值回退用它。
//
// 注意：返回直接 IP（如 host 已是 "127.0.0.1" 形式）时，LookupIP 也能正确返回。
func defaultLookup(ctx context.Context, host string) ([]net.IP, error) {
	// host 若已是 IP 字面量，跳过 DNS 直接解析
	if ip := net.ParseIP(host); ip != nil {
		return []net.IP{ip}, nil
	}
	resolver := net.DefaultResolver
	// stripPort 由调用方保证 host 无端口；这里仅查 A/AAAA
	return resolver.LookupIP(ctx, "ip", host)
}

// CheckHost 对解析后的 IP 列表做私网校验（防 DNS 重绑定）。
//
// 调用方应在 Get 请求实际发起前调用（即 DNS 解析后、建立连接前）。
// 任一解析结果命中私网/保留段即整体拒绝（保守策略，防攻击者混入一个公网 IP 绕过）。
//
// lookup 参数为 nil 时使用系统默认 DNS。测试可注入假函数模拟 DNS 返回值，
// 不依赖真实网络。
func CheckHost(ctx context.Context, host string, lookup lookupHostFn) error {
	if lookup == nil {
		ips, err := defaultLookup(ctx, host)
		if err != nil {
			return fmt.Errorf("DNS 解析 %q 失败: %w", host, err)
		}
		return checkIPs(host, ips)
	}
	ips, err := lookup(host)
	if err != nil {
		return fmt.Errorf("DNS 解析 %q 失败: %w", host, err)
	}
	return checkIPs(host, ips)
}

// checkIPs 是 CheckHost 的纯函数内核，无网络依赖，便于直接单测。
func checkIPs(host string, ips []net.IP) error {
	for _, ip := range ips {
		if IsPrivateIP(ip) {
			return fmt.Errorf("host %q 解析到私网/保留地址 %s，疑似 SSRF", host, ip.String())
		}
	}
	return nil
}

// NewSafeTransport 返回一个自带 SSRF 防护的 http.Transport：
// 每次出站连接前解析 host，校验解析结果不含私网/保留地址，再拨解析出的 IP。
//
// 防护发生在 TCP/UDP 连接建立前（DialContext 内部）：解析、校验、拨号共用
// 同一次 DNS 结果，无 TOCTOU 窗口——攻击者即使在两次独立查询间切换记录
// （DNS 重绑定），实际拨号的也是已通过校验的 IP。
// 不破坏 TLS SNI 与 HTTP Host：二者由 Transport 上层取 URL 原 host，与拨号目标解耦。
//
// 默认拨号超时 15s，与抓取管线对齐。Transport 可复用，零配置即可接入 http.Client。
func NewSafeTransport() *http.Transport {
	dialer := &net.Dialer{
		Timeout: 15 * time.Second,
	}
	return &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				// 无端口的字面量（罕见），原样用作 host
				host = addr
			}
			// 解析一次 → 校验 → 拨解析出的 IP，消除 TOCTOU 窗口
			ips, err := defaultLookup(ctx, host)
			if err != nil {
				return nil, fmt.Errorf("DNS 解析 %q 失败: %w", host, err)
			}
			if err := checkIPs(host, ips); err != nil {
				return nil, err
			}
			// 全部 IP 已通过私网校验，拨任一结果均安全，取第一个
			target := ips[0].String()
			if port != "" {
				target = net.JoinHostPort(target, port)
			}
			return dialer.DialContext(ctx, network, target)
		},
	}
}
