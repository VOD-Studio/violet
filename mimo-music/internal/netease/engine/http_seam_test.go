// Package engine 的 HTTP seam 测试(NewNeteaseRequest)。
package engine

import (
	"context"
	"net/http"
	"testing"
)

// TestNewNeteaseRequest_HeadersMatchInternal 验证导出的 NewNeteaseRequest 产出的
// 请求头与内部 setCommonHeaders 完全一致——这是 prefactor 的核心契约:
// 调用方用 NewNeteaseRequest 构造的请求,带和 engine 内部请求相同的伪装头。
//
// 对照方式:SUT 走 NewNeteaseRequest;对照组用裸 http.NewRequestWithContext(不经 SUT)
// 再单独调 setCommonHeaders。两条独立路径产出的 header 必须相等。
// 若对照组也走 NewNeteaseRequest,测试退化为 SUT==SUT 的恒真,失去验证意义。
func TestNewNeteaseRequest_HeadersMatchInternal(t *testing.T) {
	const url = "https://m701.music.126.net/some-track.mp3"
	const cookie = "MUSIC_U=fake; __csrf=abc"

	// SUT:导出 seam 构造的请求
	exportedReq, err := NewNeteaseRequest(context.Background(), "GET", url, cookie)
	if err != nil {
		t.Fatalf("NewNeteaseRequest 失败: %v", err)
	}

	// 对照组:裸 http.NewRequestWithContext(不经 SUT)+ 单独调 setCommonHeaders。
	// 这才是独立基线——和 engine 内部 transport 的构造方式一致。
	internalReq, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		t.Fatalf("构造对照请求失败: %v", err)
	}
	setCommonHeaders(internalReq, cookie)

	cases := []struct {
		name, got, want string
	}{
		{"Referer", exportedReq.Header.Get("Referer"), internalReq.Header.Get("Referer")},
		{"User-Agent", exportedReq.Header.Get("User-Agent"), internalReq.Header.Get("User-Agent")},
		{"Cookie", exportedReq.Header.Get("Cookie"), internalReq.Header.Get("Cookie")},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s 不一致:导出=%q 内部=%q", c.name, c.got, c.want)
		}
	}
	if exportedReq.Method != "GET" {
		t.Errorf("Method 应为 GET,实得 %q", exportedReq.Method)
	}
	if exportedReq.URL.String() != url {
		t.Errorf("URL 应为 %q,实得 %q", url, exportedReq.URL.String())
	}
}

// TestNewNeteaseRequest_RememberMeCookie 空 cookie 时自动补 __remember_me。
// 这与 setCommonHeaders 的行为必须一致(否则网易云返回空 body)。
func TestNewNeteaseRequest_RememberMeCookie(t *testing.T) {
	req, err := NewNeteaseRequest(context.Background(), "GET", "https://example.com", "")
	if err != nil {
		t.Fatalf("NewNeteaseRequest 失败: %v", err)
	}
	got := req.Header.Get("Cookie")
	if got != "__remember_me=true" {
		t.Errorf("空 cookie 应补 __remember_me=true,实得 %q", got)
	}
}

// TestNewNeteaseRequest_AppendsRememberMe cookie 不含 __remember_me 时追加。
func TestNewNeteaseRequest_AppendsRememberMe(t *testing.T) {
	req, err := NewNeteaseRequest(context.Background(), "GET", "https://example.com", "MUSIC_U=abc")
	if err != nil {
		t.Fatalf("NewNeteaseRequest 失败: %v", err)
	}
	got := req.Header.Get("Cookie")
	want := "MUSIC_U=abc; __remember_me=true"
	if got != want {
		t.Errorf("应追加 __remember_me,期望 %q 实得 %q", want, got)
	}
}

// TestNewNeteaseRequest_PreservesExistingRememberMe cookie 已含 __remember_me 时不重复。
func TestNewNeteaseRequest_PreservesExistingRememberMe(t *testing.T) {
	cookie := "MUSIC_U=abc; __remember_me=true"
	req, err := NewNeteaseRequest(context.Background(), "GET", "https://example.com", cookie)
	if err != nil {
		t.Fatalf("NewNeteaseRequest 失败: %v", err)
	}
	got := req.Header.Get("Cookie")
	if got != cookie {
		t.Errorf("已含 __remember_me 时不应改动,期望 %q 实得 %q", cookie, got)
	}
}
