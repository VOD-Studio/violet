package linkpreview

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetcher_FetchFullOG(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html><html><head>
			<meta property="og:title" content="页面标题">
			<meta property="og:description" content="页面描述">
			<meta property="og:site_name" content="Example">
			<meta property="og:image" content="/static/cover.png">
			<meta property="og:image:secure_url" content="/static/cover2.png">
			<title>不应使用</title>
		</head><body></body></html>`))
	}))
	defer srv.Close()

	meta, err := testFetcher().Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if meta.Title != "页面标题" || meta.Description != "页面描述" || meta.SiteName != "Example" {
		t.Errorf("meta = %+v", meta)
	}
	if meta.ImageURL != "/static/cover.png" {
		t.Errorf("og:image 应取第一个变体, got %q", meta.ImageURL)
	}
}

// testFetcher 注入默认 transport 的抓取器：httptest 监听环回地址，
// SafeTransport 会拦截，故仅 SSRF 用例用 NewFetcher(nil)。
func testFetcher() *Fetcher {
	return NewFetcher(&http.Client{Transport: http.DefaultTransport})
}

func TestFetcher_Fallbacks(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head>
			<meta name="twitter:title" content="TW 标题">
			<meta name="twitter:image" content="https://cdn.example/tw.png">
			<meta name="description" content="meta 描述">
			<title>HTML 标题</title>
		</head></html>`))
	}))
	defer srv.Close()

	meta, err := testFetcher().Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if meta.Title != "TW 标题" {
		t.Errorf("title 回退链失败: %q", meta.Title)
	}
	if meta.Description != "meta 描述" {
		t.Errorf("description 回退链失败: %q", meta.Description)
	}
	if meta.ImageURL != "https://cdn.example/tw.png" {
		t.Errorf("image 回退失败: %q", meta.ImageURL)
	}
}

func TestFetcher_TitleFallbackOnly(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte(`<html><head><title>只有标题</title></head></html>`))
	}))
	defer srv.Close()

	meta, err := testFetcher().Fetch(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if meta.Title != "只有标题" {
		t.Errorf("title = %q, want <title> 兜底", meta.Title)
	}
}

func TestFetcher_NonHTMLRejected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	if _, err := testFetcher().Fetch(context.Background(), srv.URL); err == nil {
		t.Error("非 HTML 响应应被拒绝")
	}
}

func TestFetcher_BadStatusRejected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	if _, err := testFetcher().Fetch(context.Background(), srv.URL); err == nil {
		t.Error("404 应被拒绝")
	}
}

func TestFetcher_PrivateAddressRejected(t *testing.T) {
	// SafeTransport 在连接层拦截环回地址，无须真实服务器。
	f := NewFetcher(nil)
	for _, u := range []string{"http://127.0.0.1:1/a", "http://169.254.169.254/latest/meta-data"} {
		if _, err := f.Fetch(context.Background(), u); err == nil {
			t.Errorf("%s 应被 SSRF 拦截", u)
		}
	}
}

func TestFetcher_RedirectLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 自我循环重定向。
		http.Redirect(w, r, r.URL.String(), http.StatusFound)
	}))
	defer srv.Close()

	if _, err := testFetcher().Fetch(context.Background(), srv.URL); err == nil {
		t.Error("重定向超限应被拒绝")
	}
}

func TestFetcher_HugeBodyRejected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>" + strings.Repeat("a", 3<<20) + "</html>"))
	}))
	defer srv.Close()

	if _, err := testFetcher().Fetch(context.Background(), srv.URL); err == nil {
		t.Error("超过 2MiB 的响应应被拒绝")
	}
}
