package music

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSafeURL_RejectsPrivateIP(t *testing.T) {
	// AWS/云元数据端点（SSRF 经典目标）
	require.Error(t, safeURL("http://169.254.169.254/latest/meta-data/"))
	// 私网段
	require.Error(t, safeURL("http://10.0.0.1/admin"))
	require.Error(t, safeURL("http://192.168.1.1/admin"))
	require.Error(t, safeURL("http://172.16.0.1/admin"))
}

func TestSafeURL_RejectsLoopback(t *testing.T) {
	require.Error(t, safeURL("http://localhost:9090/admin"))
	require.Error(t, safeURL("http://127.0.0.1/admin"))
	require.Error(t, safeURL("http://[::1]/admin"))
}

func TestSafeURL_RejectsNonHTTP(t *testing.T) {
	require.Error(t, safeURL("file:///etc/passwd"))
	require.Error(t, safeURL("gopher://attacker/"))
	require.Error(t, safeURL("ftp://example.com/x"))
}

func TestSafeURL_AllowsPublicHTTPS(t *testing.T) {
	// example.com 是保留域名，解析到公网 IANA 地址，应放行
	assert.NoError(t, safeURL("https://example.com/lyrics.lrc"))
	assert.NoError(t, safeURL("http://example.com/x"))
}

func TestSafeURL_RejectsEmpty(t *testing.T) {
	require.Error(t, safeURL(""))
	require.Error(t, safeURL("http://"))
}
