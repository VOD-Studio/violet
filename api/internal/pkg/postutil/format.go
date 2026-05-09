// Package postutil 提供文章相关的通用工具函数
package postutil

import (
	"database/sql"
	"time"
)

// FormatPublishedAt 格式化发布时间
// 将 sql.NullTime 转换为 ISO 8601 格式字符串，无效时间返回空字符串
func FormatPublishedAt(t sql.NullTime) string {
	if t.Valid {
		return t.Time.Format(time.RFC3339)
	}
	return ""
}

// FormatTime 将 time.Time 格式化为 ISO 8601 字符串
func FormatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}
