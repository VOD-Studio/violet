package tweet

import (
	"encoding/json"
	"os"
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
		{"裸域名识别", "去 example.com 看看", []string{"https://example.com/"}},
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

func TestExtractURLs_SharedFixtures(t *testing.T) {
	data, err := os.ReadFile("../../domain/linkpreview/testdata/urls.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Tokenization []struct {
			Name    string `json:"name"`
			Input   string `json:"input"`
			Matches []struct {
				Key string `json:"key"`
			} `json:"matches"`
		} `json:"tokenization"`
	}
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, sample := range fixtures.Tokenization {
		t.Run(sample.Name, func(t *testing.T) {
			want := make([]string, 0, len(sample.Matches))
			seen := make(map[string]bool, len(sample.Matches))
			for _, match := range sample.Matches {
				if !seen[match.Key] {
					want = append(want, match.Key)
					seen[match.Key] = true
				}
			}
			assert.Equal(t, want, ExtractURLs(sample.Input))
		})
	}
}
