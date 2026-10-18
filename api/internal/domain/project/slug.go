package project

import (
	"regexp"
	"strings"

	"blog-api/internal/domain/shared"
)

const maxSlugLength = 255

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// GenerateSlug 保留标题中的 ASCII 词段；无法生成时使用完整项目 ID，重试结果保持一致。
func GenerateSlug(title string, id shared.ID) string {
	lowercase := strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return r
	}, title)
	slug := strings.Trim(nonSlug.ReplaceAllString(lowercase, "-"), "-")
	if len(slug) > 60 {
		slug = strings.TrimRight(slug[:60], "-")
	}
	if slug == "" {
		return "project-" + id.String()
	}
	return slug
}

// IsValidSlug 在公共格式约束之外限制持久化长度为 255 字符。
func IsValidSlug(slug string) bool {
	return len(slug) <= maxSlugLength && shared.IsValidSlug(slug)
}
