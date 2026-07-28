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
	"io"
	"net"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- ValidateURL：协议白名单 + host 文本校验 ----

func TestValidateURL_RejectsNonHTTPScheme(t *testing.T) {
	for _, raw := range []string{"file:///etc/passwd", "ftp://example.com", "gopher://x", "dict://x"} {
		_, err := ValidateURL(raw)
		assert.Error(t, err, "%s 应被拒绝（非 http(s) 协议）", raw)
	}
}

func TestValidateURL_RejectsMissingHost(t *testing.T) {
	_, err := ValidateURL("http:///path")
	assert.Error(t, err, "缺 host 应被拒绝")
}

func TestValidateURL_AcceptsHTTPAndHTTPS(t *testing.T) {
	for _, raw := range []string{"http://example.com", "https://example.com/a?b=c"} {
		_, err := ValidateURL(raw)
		assert.NoError(t, err, "%s 应放行", raw)
	}
}

// ---- IsPrivateIP：私网/保留地址判定 ----

func TestIsPrivateIP_RejectsPrivateRanges(t *testing.T) {
	cases := []string{
		// IPv4 私网
		"127.0.0.1", "127.1.2.3", // loopback
		"10.0.0.1", "10.255.255.255", // 10/8
		"172.16.0.1", "172.31.255.255", // 172.16/12
		"192.168.1.1", "192.168.0.0", // 192.168/16
		"169.254.169.254", "169.254.0.1", // link-local / 云元数据
		"100.64.0.1", "100.127.255.254", // CGNAT 100.64.0.0/10（RFC 6598）
		"0.0.0.0", "0.0.0.1", // 0/8
		"224.0.0.1", "239.0.0.1", // 多播
	}
	for _, ip := range cases {
		parsed := net.ParseIP(ip)
		require.NotNil(t, parsed, "测试数据本身非法: %s", ip)
		assert.True(t, IsPrivateIP(parsed), "%s 应判为私网/保留", ip)
	}
}

func TestIsPrivateIP_AcceptsPublicAddresses(t *testing.T) {
	cases := []string{
		"8.8.8.8", "1.1.1.1", "93.184.216.34", // 公网
		"100.63.255.255", "100.128.0.1", // CGNAT 区间两侧边界（公网）
	}
	for _, ip := range cases {
		parsed := net.ParseIP(ip)
		require.NotNil(t, parsed)
		assert.False(t, IsPrivateIP(parsed), "%s 应判为公网", ip)
	}
}

func TestIsPrivateIP_RejectsIPv6Private(t *testing.T) {
	cases := []string{
		"::1",       // loopback
		"fe80::1",   // link-local
		"fc00::1",   // ULA fc00::/7
		"fd00::1",   // ULA fc00::/7（fd00 属于 fc00::/7）
		"ff02::1",   // 多播
	}
	for _, ip := range cases {
		parsed := net.ParseIP(ip)
		require.NotNil(t, parsed)
		assert.True(t, IsPrivateIP(parsed), "%s 应判为私网/保留", ip)
	}
}

// ---- CheckHost：DNS 解析后 IP 校验（防 DNS 重绑定） ----

func TestCheckHost_RejectsWhenAllIPsPrivate(t *testing.T) {
	// 模拟 DNS 返回私网 IP（无需真实 DNS）
	err := CheckHost(context.Background(), "example.com", func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	})
	assert.Error(t, err, "DNS 解析到 127.0.0.1 应拒绝")
}

func TestCheckHost_RejectsWhenAnyIPPrivate(t *testing.T) {
	// 公网 + 私网混合：任一私网都应拒绝（保守策略）
	err := CheckHost(context.Background(), "example.com", func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("8.8.8.8"), net.ParseIP("169.254.169.254")}, nil
	})
	assert.Error(t, err, "混合 IP 中含 169.254（云元数据）应拒绝")
}

func TestCheckHost_AcceptsAllPublicIPs(t *testing.T) {
	err := CheckHost(context.Background(), "example.com", func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	})
	assert.NoError(t, err, "全部公网 IP 应放行")
}

func TestCheckHost_PropagatesDNSError(t *testing.T) {
	err := CheckHost(context.Background(), "nonexistent.invalid", func(host string) ([]net.IP, error) {
		return nil, &net.DNSError{Err: "no such host", Name: host}
	})
	assert.Error(t, err, "DNS 解析失败应传播错误")
}

// ---- LimitBody：响应体大小限制 ----

func TestLimitBody_AllowsUnderLimit(t *testing.T) {
	body := io.NopCloser(strings.NewReader("hello"))
	limited := LimitBody(body, 100)
	got, err := io.ReadAll(limited)
	require.NoError(t, err)
	assert.Equal(t, "hello", string(got))
}

func TestLimitBody_RejectsOverLimit(t *testing.T) {
	// 5MB body，上限 1MB，应读到上限后返回错误
	big := strings.NewReader(strings.Repeat("x", 5*1024*1024))
	body := io.NopCloser(big)
	limited := LimitBody(body, 1024*1024)
	_, err := io.ReadAll(limited)
	assert.Error(t, err, "超过上限应返回错误而非静默截断")
}

func TestLimitBody_BoundaryExactlyAtLimit(t *testing.T) {
	// 正好等于上限：应成功读完
	payload := strings.Repeat("x", 100)
	body := io.NopCloser(strings.NewReader(payload))
	limited := LimitBody(body, 100)
	got, err := io.ReadAll(limited)
	require.NoError(t, err, "正好等于上限应成功")
	assert.Equal(t, payload, string(got))
}
