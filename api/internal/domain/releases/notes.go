package releases

import (
	"regexp"
	"strings"
)

var (
	commitRefParenLink = regexp.MustCompile(`\s*\(\[[0-9a-f]{7,40}\]\([^)]*\)\)`)
	commitRefLink      = regexp.MustCompile(`\s*\[[0-9a-f]{7,40}\]\([^)]*\)`)
	commitRefText      = regexp.MustCompile(`\s*\([0-9a-f]{7,40}\)`)
	changeScope        = regexp.MustCompile(`^\*\*[A-Za-z0-9_.-]+:\*\*\s*`)
)

// WithoutCommitReference 移除短 SHA 引用，保留 PR 和议题编号。
func WithoutCommitReference(item string) string {
	item = commitRefParenLink.ReplaceAllString(item, "")
	item = commitRefLink.ReplaceAllString(item, "")
	item = commitRefText.ReplaceAllString(item, "")
	return strings.TrimSpace(item)
}

// FirstChangeSummary 取公开发布说明的第一条变更，不返回完整正文。
func FirstChangeSummary(body string) string {
	var fence string
	for line := range strings.SplitSeq(body, "\n") {
		line = strings.TrimSpace(line)
		if fence != "" {
			if strings.HasPrefix(line, fence) {
				fence = ""
			}
			continue
		}
		if strings.HasPrefix(line, "```") || strings.HasPrefix(line, "~~~") {
			fence = line[:3]
			continue
		}
		if line == "## New Contributors" {
			return ""
		}
		if strings.HasPrefix(line, "* ") || strings.HasPrefix(line, "- ") {
			item := changeScope.ReplaceAllString(WithoutCommitReference(line[2:]), "")
			item = strings.TrimSpace(strings.ReplaceAll(item, "**", ""))
			if item != "" {
				return item
			}
		}
	}
	return ""
}
