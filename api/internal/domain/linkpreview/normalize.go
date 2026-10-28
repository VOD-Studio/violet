package linkpreview

import (
	"net/url"
	"strings"
)

// NormalizeURL 规范化 URL 作为卡片唯一键：小写协议与主机、去默认端口、去 fragment。
// 解析失败或非 http(s) 返回空串（调用方丢弃该 URL，不建卡片）。
func NormalizeURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" || parsed.Host == "" {
		return ""
	}
	parsed.Scheme = strings.ToLower(parsed.Scheme)
	host := strings.ToLower(parsed.Hostname())
	if port := parsed.Port(); port != "" &&
		!((parsed.Scheme == "http" && port == "80") || (parsed.Scheme == "https" && port == "443")) {
		host += ":" + port
	}
	parsed.Host = host
	parsed.Fragment = ""
	parsed.RawFragment = ""
	// 带 userinfo 的地址不具备共享缓存意义，丢弃。
	if parsed.User != nil {
		return ""
	}
	return parsed.String()
}

// NormalizeURLs 批量规范化并去重、过滤空值、保序（首次出现顺序）。
func NormalizeURLs(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, u := range raw {
		n := NormalizeURL(u)
		if n == "" {
			continue
		}
		if _, ok := seen[n]; ok {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	return out
}
