// Package session 管理 cookie 池，是网易云登录态的一等公民。
//
// 网易云风控按账号/Cookie 维度，不按接口维度——所以 GetAvailable 的参数是
// AuthRequirement enum 而非字符串。登录类接口（captcha/login/qrcode）是创建
// 新 session 的源头，走 Save 路径，不经 GetAvailable。
//
// SessionStore 接口由 engine 层依赖（依赖倒置），运行时层注入 Redis 实现。
package session

import (
	"context"
	"errors"
)

// AuthRequirement 表达一次调用需要哪种登录态，驱动 cookie 池选取。
type AuthRequirement int

const (
	// AuthAnonymous 用共享匿名 cookie 池（网易云大部分查询接口可用）。
	AuthAnonymous AuthRequirement = iota
	// AuthLoggedIn 用已登录 cookie 池（需登录态的接口，含健康度/权重选取）。
	AuthLoggedIn
)

// Session 是一个登录态凭证。
type Session struct {
	// UserID 是网易云用户 ID。
	UserID string
	// Cookie 是登录态 Cookie 字符串。
	Cookie string
}

// SessionStore 管理 cookie 池，提供选取和创建两种路径。
//
// 选取路径：engine 调 GetAvailable 按 AuthRequirement 取一个可用 session，
// 调用结果通过 ReportSuccess/ReportFailure 反馈，驱动健康度/权重。
// 创建路径：登录类接口调 Save 写入新 session，不经 GetAvailable。
type SessionStore interface {
	// GetAvailable 按登录态需求选取一个可用 session。
	// 全部不可用时返回 ErrNoAvailableSession。
	GetAvailable(ctx context.Context, req AuthRequirement) (*Session, error)

	// ReportSuccess 上报某 session 调用成功（用于健康度统计）。
	ReportSuccess(sessionID string)

	// ReportFailure 上报某 session 调用失败（用于风控/降权）。
	ReportFailure(sessionID string, err error)

	// Save 保存新 session（登录成功后写入 cookie 池）。
	Save(ctx context.Context, s *Session) error

	// ListAll 列出全部 session 的 userID（worker 健康检查用）。
	ListAll(ctx context.Context) ([]string, error)
}

// ErrNoAvailableSession 是全部 session 都不可用时的错误。
var ErrNoAvailableSession = errors.New("所有 session 均不可用")
