package bilibili

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchEmojis_NoCookie(t *testing.T) {
	c := NewClient("")
	_, err := c.FetchEmojis(context.Background(), "user")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "未设置 B站 Cookie")
}

func TestFetchEmojis_UserAPI(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "test-cookie", r.Header.Get("Cookie"))
		assert.Equal(t, "https://www.bilibili.com", r.Header.Get("Referer"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"code": 0,
			"data": {
				"packages": [
					{"id": 1, "text": "test", "url": "https://example.com/cover.png", "type": 1,
					 "emote": [{"text": "[test]", "url": "https://example.com/e.png"}]},
					{"id": 2, "text": "fav", "type": 13, "emote": []}
				]
			}
		}`))
	}))
	defer srv.Close()

	c := NewClient("test-cookie", WithHTTPClient(srv.Client()))
	// 用未导出的 fetchEmojisFrom 指向 httptest server
	packages, err := c.fetchEmojisFrom(context.Background(), srv.URL+"/panel", "user")
	require.NoError(t, err)
	require.Len(t, packages, 1)
	assert.Equal(t, "test", packages[0].Text)
}

func TestFetchEmojis_APIError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code": -101, "message": "账号未登录"}`))
	}))
	defer srv.Close()

	c := NewClient("test-cookie", WithHTTPClient(srv.Client()))
	_, err := c.fetchEmojisFrom(context.Background(), srv.URL+"/panel", "user")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "API 错误")
}
