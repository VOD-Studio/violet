// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import "errors"

// 认证相关错误定义，用于区分不同业务异常
var (
	// ErrEmailAlreadyExists 邮箱已被注册
	ErrEmailAlreadyExists = errors.New("邮箱已被注册")
	// ErrUsernameAlreadyExists 用户名已被占用
	ErrUsernameAlreadyExists = errors.New("用户名已被占用")
	// ErrInvalidCredentials 邮箱或密码错误
	ErrInvalidCredentials = errors.New("邮箱或密码错误")
	// ErrAccountNotActivated 账户未激活，需要先验证邮箱
	ErrAccountNotActivated = errors.New("账户未激活，请先验证邮箱")
	// ErrInvalidVerificationCode 验证码无效或已过期
	ErrInvalidVerificationCode = errors.New("验证码无效或已过期")
	// ErrTooManyAttempts 验证码尝试次数过多
	ErrTooManyAttempts = errors.New("验证码尝试次数过多，请重新获取")
	// ErrInvalidRefreshToken 刷新令牌无效或已过期
	ErrInvalidRefreshToken = errors.New("刷新令牌无效或已过期")
	// ErrUserNotFound 用户不存在
	ErrUserNotFound = errors.New("用户不存在")
)
