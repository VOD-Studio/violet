package tweet

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractURLs(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    []string
	}{
		{"www 前缀补协议并规范化", "打开 www.Example.com/a#frag", []string{"https://www.example.com/a"}},
		{"无链接", "纯文本 #话题# [doge]", []string{}},
		{"http 与 https", "见 https://Example.com/A?x=1 和 http://cn.example.com:8080/p", []string{"https://example.com/A?x=1", "http://cn.example.com:8080/p"}},
		{"尾部中英文标点剥离", "链接 https://example.com/a。，；）】还有 https://example.com/b).", []string{"https://example.com/a", "https://example.com/b"}},
		{"裸域名不识别", "去 example.com 看看", []string{}},
		{"去重保序", "https://example.com/a 与 https://example.com/a 和 https://example.com/b", []string{"https://example.com/a", "https://example.com/b"}},
		{"默认端口与小写主机", "HTTPS://EXAMPLE.COM:443/x", []string{"https://example.com/x"}},
		{"带 userinfo 丢弃", "https://user:pass@example.com/x", []string{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.want, ExtractURLs(c.content))
		})
	}
}
