// Package service 提供业务逻辑层
package service

import (
	"database/sql"
	"strings"
)

// toNullString 将字符串转换为可空指针
func toNullString(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// toSQLNullString 将字符串转换为 sql.NullString
func toSQLNullString(s string) sql.NullString {
	s = strings.TrimSpace(s)
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}
