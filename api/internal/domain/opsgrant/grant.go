// Package opsgrant 定义短时运维授权：绑定用户、会话、操作类别与有效期的
// 二次验证凭据。授权由「已验证密码」或「账号绑定邮箱验证码」换取，用于
// 高危操作（安全策略确认、SQL 写入、恢复等）前的短时提权。
//
// 不变量：
//   - 授权绑定单一 session：换设备、重新登录后即不可用
//   - 不可跨类别复用：security 类别不能消费 sql 类别
//   - 失效即时：退出、改密、会话吊销、撤权由调用方同步吊销；超时由 Redis TTL 兜底
//   - 授权本身不是权限：每次高危提交仍须重新校验角色/权限码
package opsgrant

import (
	"time"
)

// Category 授权覆盖的操作类别。新高危能力接入时在此追加，不复用宽泛类别。
type Category string

const (
	// CategorySecurity 安全策略确认（可信来源/可信代理/Cookie 约束变更生效）
	CategorySecurity Category = "security"
)

// Valid 判断类别是否已注册。
func (c Category) Valid() bool {
	switch c {
	case CategorySecurity:
		return true
	}
	return false
}

// String 返回类别字符串。
func (c Category) String() string { return string(c) }

// Categories 返回全部已注册类别。
func Categories() []Category { return []Category{CategorySecurity} }

// Grant 一次短时运维授权。
type Grant struct {
	// userID 被授权用户（与签发验证通过者一致）
	userID string
	// sessionID 授权绑定的 session，凭据只在当前会话内有效
	sessionID string
	// category 允许消费的操作类别
	category Category
	// expiresAt 授权截止时间
	expiresAt time.Time
}

// NewGrant 构造授权；category 必须已注册，否则返回零值与 false。
func NewGrant(userID, sessionID string, category Category, expiresAt time.Time) (Grant, bool) {
	if !category.Valid() || userID == "" || sessionID == "" {
		return Grant{}, false
	}
	return Grant{userID: userID, sessionID: sessionID, category: category, expiresAt: expiresAt}, true
}

func (g Grant) UserID() string { return g.userID }

func (g Grant) SessionID() string { return g.sessionID }

func (g Grant) Category() Category { return g.category }

func (g Grant) ExpiresAt() time.Time { return g.expiresAt }

// Covers 判断该授权能否覆盖指定用户/会话/类别的消费请求。
func (g Grant) Covers(userID, sessionID string, category Category, now time.Time) bool {
	return g.userID == userID && g.sessionID == sessionID && g.category == category && !now.After(g.expiresAt)
}
