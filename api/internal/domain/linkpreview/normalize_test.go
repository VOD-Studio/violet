package linkpreview

import "testing"

func TestNormalizeURL(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"主机小写与保留路径", "HTTP://Example.COM/A?b=1#c", "http://example.com/A?b=1"},
		{"去 http 默认端口", "http://example.com:80/a", "http://example.com/a"},
		{"去 https 默认端口", "https://example.com:443/a", "https://example.com/a"},
		{"中文路径归一为编码形式", "https://example.com/文章/第一篇", "https://example.com/%E6%96%87%E7%AB%A0/%E7%AC%AC%E4%B8%80%E7%AF%87"},
		{"空白剥离", "  https://example.com/a  ", "https://example.com/a"},
		{"拒绝 ftp", "ftp://example.com/a", ""},
		{"拒绝 javascript", "javascript:alert(1)", ""},
		{"拒绝裸文本", "不是链接", ""},
		{"拒绝 userinfo", "https://user:pass@example.com/a", ""},
		{"拒绝协议相对", "//example.com/a", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := NormalizeURL(c.in); got != c.want {
				t.Errorf("NormalizeURL(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestNormalizeURLs_DedupPreservesOrder(t *testing.T) {
	in := []string{
		"https://B.com/x", "https://a.com/1", "https://b.com/x", "bad", "https://a.com/1", "https://c.com/",
	}
	want := []string{"https://b.com/x", "https://a.com/1", "https://c.com/"}
	got := NormalizeURLs(in)
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}
