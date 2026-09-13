package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetClientIP_IgnoresForwardedHeadersWhenNoTrustedProxies(t *testing.T) {
	ipExtractor = newIPExtractor(nil)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.Header.Set("X-Real-IP", "5.6.7.8")
	req.RemoteAddr = "9.9.9.9:1234"

	assert.Equal(t, "9.9.9.9", getClientIP(req))
}

func TestGetClientIP_TrustsForwardedHeaderFromTrustedProxy(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "1.2.3.4", getClientIP(req))
}

func TestGetClientIP_IgnoresForwardedHeaderFromUntrustedRemoteAddr(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "8.8.8.8:1234" // 不是受信代理

	assert.Equal(t, "8.8.8.8", getClientIP(req))
}

func TestGetClientIP_StripsTrustedProxyChainFromRight(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// 伪造前缀 + 真实客户端 + 可信 nginx 追加的来访者
	req.Header.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8, 10.0.0.2")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "5.6.7.8", getClientIP(req))
}

func TestGetClientIP_ForgedPrefixBehindTrustedProxyIsIgnored(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	// 客户端直连可信代理：XFF 仅含其伪造前缀，真实地址由代理追加
	req.Header.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "5.6.7.8", getClientIP(req))
}

func TestGetClientIP_RejectsMalformedForwardedChain(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.2/32"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "not-an-ip, 5.6.7.8")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "10.0.0.2", getClientIP(req))
}

func TestGetClientIP_AllTrustedChainFallsBackToLeftmost(t *testing.T) {
	ipExtractor = newIPExtractor([]string{"10.0.0.0/24"})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "10.0.0.5, 10.0.0.6")
	req.RemoteAddr = "10.0.0.2:5678"

	assert.Equal(t, "10.0.0.5", getClientIP(req))
}

func TestNewIPExtractor_BareIPv6TreatedAsSingleHost(t *testing.T) {
	e := newIPExtractor([]string{"fd00::1"})
	assert.True(t, e.isTrustedIP("fd00::1"))
	assert.False(t, e.isTrustedIP("fd00::2"))
}
