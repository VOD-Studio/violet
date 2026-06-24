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

	assert.Equal(t, "9.9.9.9:1234", getClientIP(req))
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

	assert.Equal(t, "8.8.8.8:1234", getClientIP(req))
}
