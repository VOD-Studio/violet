package tweet

import (
	"regexp"
	"strings"

	domainlink "blog-api/internal/domain/linkpreview"
)

// urlPattern 匹配正文中的链接候选：https?:// 或 www. 开头 + 域名字符起头，
// 其后为 ASCII URL 字符（到空白或中文标号前止）；裸域名不识别（首版与前端渲染口径一致）。
var urlPattern = regexp.MustCompile(`(?i)\b(?:https?://|www\.)[A-Za-z0-9.-]+[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*`)

// urlTrailingPunct 候选尾部可能吞并的标点（英文与中文），剥离后才进入规范化。
const urlTrailingPunct = ".,;:!?)]。，；：！？）】"

// ExtractURLs 提取正文中的链接并规范化：域名字符起头、尾部标点剥离、
// www. 前缀补 https://、NormalizeURL 过滤后去重保序。
func ExtractURLs(content string) []string {
	matches := urlPattern.FindAllString(content, -1)
	raw := make([]string, 0, len(matches))
	for _, m := range matches {
		m = strings.TrimRight(m, urlTrailingPunct)
		if m == "" {
			continue
		}
		if strings.HasPrefix(strings.ToLower(m), "www.") {
			m = "https://" + m
		}
		raw = append(raw, m)
	}
	return domainlink.NormalizeURLs(raw)
}
