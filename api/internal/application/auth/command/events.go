package command

import (
	"blog-api/internal/domain/shared"
)

// UserLoggedIn 用户登录成功事件（应用层事实，非聚合根状态变更）。
//
// 订阅者：审计服务（记录登录操作）。
type UserLoggedIn struct {
	shared.BaseEvent
	// Provider 登录方式：password | google | github
	Provider string
}

// NewUserLoggedIn 构造登录成功事件
func NewUserLoggedIn(userID shared.ID, provider string) UserLoggedIn {
	return UserLoggedIn{
		BaseEvent: shared.NewBaseEvent("auth.logged_in", userID),
		Provider:  provider,
	}
}

// UserLoggedOut 用户登出事件（应用层事实）。
//
// 订阅者：审计服务（记录登出操作）。
type UserLoggedOut struct {
	shared.BaseEvent
}

// NewUserLoggedOut 构造登出事件
func NewUserLoggedOut(userID shared.ID) UserLoggedOut {
	return UserLoggedOut{
		BaseEvent: shared.NewBaseEvent("auth.logged_out", userID),
	}
}

// UserLoginFailed 登录失败事件（应用层事实）。
//
// 订阅者：审计服务（记录失败尝试，便于发现暴力破解）。
// Reason 记录失败原因（密码错误/邮箱未验证/账户禁用），不记录密码明文。
type UserLoginFailed struct {
	shared.BaseEvent
	// Reason 失败原因（不记密码明文）
	Reason string
}

// NewUserLoginFailed 构造登录失败事件。
// aggregateID 用零值（登录失败时未确认用户身份）。
func NewUserLoginFailed(reason string) UserLoginFailed {
	return UserLoginFailed{
		BaseEvent: shared.NewBaseEvent("auth.login_failed", shared.ID{}),
		Reason:    reason,
	}
}
