package netease

import (
	"net/http"
	"testing"
)

// TestExtractCookies_MergeDedup 验证多个 Set-Cookie 合并去重。
func TestExtractCookies_MergeDedup(t *testing.T) {
	resp := &http.Response{Header: http.Header{}}
	resp.Header.Add("Set-Cookie", "MUSIC_U=abc123; Path=/; Domain=.music.163.com")
	resp.Header.Add("Set-Cookie", "__csrf=xyz789; Path=/; Domain=.music.163.com")

	cookie := extractCookies(resp)

	if cookie == "" {
		t.Fatal("期望非空 Cookie，实际空")
	}
	if !containsKV(cookie, "MUSIC_U=abc123") {
		t.Errorf("Cookie 缺少 MUSIC_U=abc123: %q", cookie)
	}
	if !containsKV(cookie, "__csrf=xyz789") {
		t.Errorf("Cookie 缺少 __csrf=xyz789: %q", cookie)
	}
}

// TestExtractCookies_SameNameOverwrite 验证同名的 cookie 后者覆盖前者。
func TestExtractCookies_SameNameOverwrite(t *testing.T) {
	resp := &http.Response{Header: http.Header{}}
	resp.Header.Add("Set-Cookie", "MUSIC_U=old; Path=/")
	resp.Header.Add("Set-Cookie", "MUSIC_U=new; Path=/")

	cookie := extractCookies(resp)

	if !containsKV(cookie, "MUSIC_U=new") {
		t.Errorf("同名 cookie 应后者覆盖前者，得到: %q", cookie)
	}
	if containsKV(cookie, "MUSIC_U=old") {
		t.Errorf("旧值不应保留: %q", cookie)
	}
}

// TestExtractCookies_NoSetCookie 验证无 Set-Cookie 头时返回空。
func TestExtractCookies_NoSetCookie(t *testing.T) {
	resp := &http.Response{Header: http.Header{}}

	cookie := extractCookies(resp)
	if cookie != "" {
		t.Errorf("无 Set-Cookie 时应返回空，得到: %q", cookie)
	}
}

// TestExtractCookies_StripsAttributes 验证 cookie 的 Path / Domain 等属性被去掉。
func TestExtractCookies_StripsAttributes(t *testing.T) {
	resp := &http.Response{Header: http.Header{}}
	resp.Header.Add("Set-Cookie", "MUSIC_U=abc123; Path=/; Domain=.music.163.com; HttpOnly")

	cookie := extractCookies(resp)

	if !containsKV(cookie, "MUSIC_U=abc123") {
		t.Errorf("Cookie 应只含 name=value: %q", cookie)
	}
	// 不应包含 Path / Domain / HttpOnly
	for _, attr := range []string{"Path", "Domain", "HttpOnly"} {
		if containsKV(cookie, attr) {
			t.Errorf("Cookie 不应包含属性 %s: %q", attr, cookie)
		}
	}
}

// containsKV 检查 "k=v; k=v" 格式的 cookie 字符串是否包含指定 "name=value" 片段。
func containsKV(cookie, kv string) bool {
	for _, part := range splitSemicolon(cookie) {
		if part == kv {
			return true
		}
	}
	return false
}

// splitSemicolon 按 "; " 分割字符串。
func splitSemicolon(s string) []string {
	var parts []string
	current := ""
	for _, c := range s {
		if c == ';' {
			continue
		}
		if c == ' ' {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
			continue
		}
		current += string(c)
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}
