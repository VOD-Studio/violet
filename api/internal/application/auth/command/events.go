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

// ProviderBound OAuth 身份绑定到账号事件（应用层事实）。
//
// 订阅者：审计服务（记录绑定操作，provider id 属敏感关联面）。
type ProviderBound struct {
	shared.BaseEvent
	// Provider 绑定的提供方：google | github
	Provider string
}

// NewProviderBound 构造绑定事件
func NewProviderBound(userID shared.ID, provider string) ProviderBound {
	return ProviderBound{
		BaseEvent: shared.NewBaseEvent("auth.provider_bound", userID),
		Provider:  provider,
	}
}

// ProviderUnbound OAuth 身份解绑事件（应用层事实）。
type ProviderUnbound struct {
	shared.BaseEvent
	// Provider 解绑的提供方：google | github
	Provider string
}

// NewProviderUnbound 构造解绑事件
func NewProviderUnbound(userID shared.ID, provider string) ProviderUnbound {
	return ProviderUnbound{
		BaseEvent: shared.NewBaseEvent("auth.provider_unbound", userID),
		Provider:  provider,
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
