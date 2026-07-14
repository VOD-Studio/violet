// Package model 定义 mimo-music 的跨平台统一数据模型（DTO）。
package model

import "time"

// Session 是登录会话数据。
type Session struct {
	// UserID 是平台用户 ID。
	UserID string `json:"user_id"`

	// Cookie 是登录态 Cookie 字符串（拼接所有 cookie 键值对）。
	//
	// 绝不能明文出现在日志中，redact handler 会自动脱敏。
	Cookie string `json:"-"`

	// ExpireAt 是 Cookie 过期时间。
	ExpireAt time.Time `json:"expire_at"`
}
