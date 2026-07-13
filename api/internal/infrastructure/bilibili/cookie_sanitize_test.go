package bilibili

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSanitizeCookie 清洗逻辑：去除控制字符，保留可见字符。
// 回归：管理员从浏览器复制的 cookie 常夹带 \n / \r，导致 Header.Set 抛
// "net/http: invalid header field value"，整个重新拉取失败。
func TestSanitizeCookie(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"纯 ASCII", "SESSDATA=abc; bili_jct=def", "SESSDATA=abc; bili_jct=def"},
		{"尾部换行", "SESSDATA=abc\n", "SESSDATA=abc"},
		{"CRLF 换行", "SESSDATA=abc\r\n", "SESSDATA=abc"},
		{"中间换行", "SESSDATA=abc\nbili_jct=def", "SESSDATA=abcbili_jct=def"},
		{"制表符", "SESSDATA=abc\tdef", "SESSDATA=abcdef"},
		{"首尾空格", "  SESSDATA=abc  ", "SESSDATA=abc"},
		{"全空白", "  \n\t\r ", ""},
		{"DEL 字符 (0x7f)", "SESSDATA=abc\x7f", "SESSDATA=abc"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, sanitizeCookie(tc.input))
		})
	}
}

// TestNewClient_SanitizesCookie NewClient 入口必须清洗 cookie，
// 保证 c.cookie 不含控制字符，后续 Header.Set 不再抛错。
func TestNewClient_SanitizesCookie(t *testing.T) {
	c := NewClient("SESSDATA=abc\nbili_jct=def\r\n")
	assert.Equal(t, "SESSDATA=abcbili_jct=def", c.cookie)
}

// TestFetchEmojis_CookieWithNewlineDoesNotError 端到端回归：
// 含换行符的 cookie 经清洗后能正常发请求，不再返回 invalid header field value。
func TestFetchEmojis_CookieWithNewlineDoesNotError(t *testing.T) {
	var gotCookie string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCookie = r.Header.Get("Cookie")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":0,"data":{"packages":[]}}`))
	}))
	defer srv.Close()

	c := NewClient("SESSDATA=abc\n", WithHTTPClient(srv.Client()))
	// 直接走 fetchEmojisFrom 指向 httptest，绕过真实 B站 URL
	_, err := c.fetchEmojisFrom(context.Background(), srv.URL, "user")
	require.NoError(t, err)
	assert.Equal(t, "SESSDATA=abc", gotCookie)
}
