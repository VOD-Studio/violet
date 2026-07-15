package mimomusic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// writeEnvelope 写一个 mimo-music 风格的统一信封响应。
func writeEnvelope(w http.ResponseWriter, status, code int, data any, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	var d json.RawMessage
	if data != nil {
		d, _ = json.Marshal(data)
	} else {
		d = json.RawMessage("null")
	}
	_ = json.NewEncoder(w).Encode(envelope{Code: code, Data: d, Message: message})
}

// TestNewClient_Options 验证 Option 正确应用。
func TestNewClient_Options(t *testing.T) {
	t.Run("默认值", func(t *testing.T) {
		c := NewClient("http://localhost:3721/")
		if c.baseURL != "http://localhost:3721" {
			t.Fatalf("baseURL 应去掉结尾斜杠，得到 %q", c.baseURL)
		}
		if c.maxRetries != 3 {
			t.Fatalf("默认 maxRetries=3，得到 %d", c.maxRetries)
		}
	})

	t.Run("自定义 http client", func(t *testing.T) {
		h := &http.Client{Timeout: 5 * time.Second}
		c := NewClient("http://x", WithHTTPClient(h))
		if c.httpClient != h {
			t.Fatal("WithHTTPClient 未生效")
		}
	})

	t.Run("自定义 timeout", func(t *testing.T) {
		c := NewClient("http://x", WithTimeout(7 * time.Second))
		if c.httpClient.Timeout != 7*time.Second {
			t.Fatalf("WithTimeout 未生效，得到 %v", c.httpClient.Timeout)
		}
	})

	t.Run("自定义 retry", func(t *testing.T) {
		c := NewClient("http://x", WithRetry(0, 0))
		if c.maxRetries != 0 {
			t.Fatalf("WithRetry maxRetries 未生效，得到 %d", c.maxRetries)
		}
	})
}

// TestBusinessError 验证 HTTP 信封业务 code 到哨兵 error 的映射。
func TestBusinessError(t *testing.T) {
	cases := []struct {
		code int
		want error
	}{
		{0, nil},
		{10400, ErrInvalidRequest},
		{10401, ErrUnauthorized},
		{10404, ErrNotFound},
		{10429, ErrRateLimited},
		{10500, ErrServerError},
		{10502, ErrUpstreamUnavailable},
		{10503, ErrUnsupportedPlatform},
		{99999, ErrServerError}, // 未知 code 归到服务内部错误
	}
	for _, tc := range cases {
		err := businessError(tc.code)
		if err != tc.want && !errors.Is(err, tc.want) {
			t.Fatalf("code %d 应映射到 %v，得到 %v", tc.code, tc.want, err)
		}
	}
}

// TestDo_Success 验证成功请求把信封 data 反序列化到 out。
func TestDo_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/playlists/123" {
			t.Errorf("未预期的路径 %q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, map[string]any{
			"id":    "123",
			"title": "我的歌单",
		}, "")
	}))
	defer srv.Close()

	c := NewClient(srv.URL, WithRetry(0, 0))
	var got struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := c.doGET(context.Background(), "/api/v1/playlists/123", nil, &got); err != nil {
		t.Fatalf("成功请求不应返回错误：%v", err)
	}
	if got.ID != "123" || got.Title != "我的歌单" {
		t.Fatalf("反序列化结果错误：%+v", got)
	}
}

// TestDo_BusinessErrorCodes 验证各业务错误码映射到正确的哨兵 error。
func TestDo_BusinessErrorCodes(t *testing.T) {
	cases := []struct {
		name     string
		httpStat int
		code     int
		want     error
	}{
		{"未授权", 401, 10401, ErrUnauthorized},
		{"未找到", 404, 10404, ErrNotFound},
		{"服务内部错误", 500, 10500, ErrServerError},
		{"不支持的平台", 503, 10503, ErrUnsupportedPlatform},
		{"请求参数错误", 400, 10400, ErrInvalidRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				writeEnvelope(w, tc.httpStat, tc.code, nil, "错误说明")
			}))
			defer srv.Close()

			c := NewClient(srv.URL, WithRetry(0, 0))
			err := c.doGET(context.Background(), "/x", nil, nil)
			if !errors.Is(err, tc.want) {
				t.Fatalf("应映射到 %v，得到 %v", tc.want, err)
			}
		})
	}
}

// TestDo_RetriesOnRetryableBusinessCode 验证限流错误码触发重试。
func TestDo_RetriesOnRetryableBusinessCode(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n < 3 {
			// 前两次限流，第三次成功
			writeEnvelope(w, 429, 10429, nil, "限流")
			return
		}
		writeEnvelope(w, 200, 0, map[string]any{"ok": true}, "")
	}))
	defer srv.Close()

	c := NewClient(srv.URL, WithRetry(3, time.Millisecond))
	var got struct {
		OK bool `json:"ok"`
	}
	if err := c.doGET(context.Background(), "/x", nil, &got); err != nil {
		t.Fatalf("第三次成功后不应返回错误：%v", err)
	}
	if calls != 3 {
		t.Fatalf("应重试到第三次，实际调用 %d 次", calls)
	}
	if !got.OK {
		t.Fatal("最终结果未正确反序列化")
	}
}

// TestDo_NoRetryOnDeterministicError 验证确定性错误（404）不重试。
func TestDo_NoRetryOnDeterministicError(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		writeEnvelope(w, 404, 10404, nil, "不存在")
	}))
	defer srv.Close()

	c := NewClient(srv.URL, WithRetry(3, time.Millisecond))
	err := c.doGET(context.Background(), "/x", nil, nil)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("应返回 ErrNotFound，得到 %v", err)
	}
	if calls != 1 {
		t.Fatalf("404 不应重试，实际调用 %d 次", calls)
	}
}

// TestDo_RetriesOnHTTP5xx 验证 HTTP 5xx（信封 code=0 兜底）触发重试。
func TestDo_RetriesOnHTTP5xx(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&calls, 1)
		if n < 2 {
			writeEnvelope(w, 502, 0, nil, "")
			return
		}
		writeEnvelope(w, 200, 0, map[string]any{"ok": true}, "")
	}))
	defer srv.Close()

	c := NewClient(srv.URL, WithRetry(3, time.Millisecond))
	err := c.doGET(context.Background(), "/x", nil, nil)
	if err != nil {
		t.Fatalf("第二次成功后不应返回错误：%v", err)
	}
	if calls != 2 {
		t.Fatalf("应重试一次后成功，实际调用 %d 次", calls)
	}
}

// TestDo_ContextCancel 验证 context 取消终止重试。
func TestDo_ContextCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 429, 10429, nil, "限流")
	}))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	// 立即取消，重试前应收到 ctx.Err()
	cancel()

	c := NewClient(srv.URL, WithRetry(5, time.Second))
	err := c.doGET(ctx, "/x", nil, nil)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("应返回 context.Canceled，得到 %v", err)
	}
}

// TestDo_ContextTimeout 验证 context 超时终止请求。
func TestDo_ContextTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		writeEnvelope(w, 200, 0, map[string]any{"ok": true}, "")
	}))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	c := NewClient(srv.URL, WithRetry(0, 0))
	err := c.doGET(ctx, "/x", nil, nil)
	// 超时归到 ErrUpstreamUnavailable（网络层），但 context 超时应优先暴露
	_ = err // 只要不卡死即说明 context 生效
	if err == nil {
		t.Fatal("超时应返回错误")
	}
}

// TestDo_InvalidJSON 验证无法解析的响应返回 ErrInvalidResponse。
func TestDo_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "not-json")
	}))
	defer srv.Close()

	c := NewClient(srv.URL, WithRetry(0, 0))
	err := c.doGET(context.Background(), "/x", nil, nil)
	if !errors.Is(err, ErrInvalidResponse) {
		t.Fatalf("应返回 ErrInvalidResponse，得到 %v", err)
	}
}
