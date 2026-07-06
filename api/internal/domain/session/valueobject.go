// Package session 定义 opaque session 领域模型。
//
// opaque session：cookie 只承载一个不透明随机 id，后端必须查 SessionStore 才能
// 换出用户身份，取代历史的 access/refresh JWT。
// 决策依据见 docs/adr/0003-login-opaque-session.md。
package session

import (
	"crypto/rand"
	"encoding/base64"

	domainshared "blog-api/internal/domain/shared"
)

// ID opaque session 标识。
//
// 32 字节 cryptographically random，base64url 编码（约 43 字符）。
// 本身不含任何用户信息，后端必须查 SessionStore 才能换出身份——这是 opaque
// 模型相对 JWT 的核心区别（无可猜测结构、不可离线伪造）。
type ID string

// NewID 生成随机 session id。
//
// 读 crypto/rand 失败时返回错误，绝不降级为弱随机或固定值——session id 一旦
// 可预测，整个鉴权体系崩塌。调用方必须把错误当 500 处理。
func NewID() (ID, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return ID(base64.RawURLEncoding.EncodeToString(b)), nil
}

// CSRFToken double-submit CSRF 凭证。
//
// 与非 HttpOnly 的 mimo_csrf cookie 同值；前端读 cookie 后放入 X-CSRF-Token
// header 回传，后端比对 cookie 与 header 是否相等。
// 该值存于 session 记录中，与 session 同生命周期——session 失效即 csrf 失效。
type CSRFToken string

// NewCSRFToken 生成 32 字节随机 CSRF token，base64url 编码。
//
// 与 NewID 同样依赖 crypto/rand，失败返回错误。
func NewCSRFToken() (CSRFToken, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return CSRFToken(base64.RawURLEncoding.EncodeToString(b)), nil
}

// UserSnapshot 创建 session 时从 User 聚合快照的身份字段。
//
// session 包不反向依赖 user 包（避免循环依赖），调用方在 application 层从
// *user.User 抽取这些字段构造快照传入。这些字段会被持久化进 Redis session
// 记录，供鉴权中间件不查 user 表即可注入 context。
type UserSnapshot struct {
	// UserID 用户唯一标识，来自 user.User.GetID()
	UserID domainshared.ID
	// Email 用户邮箱，供 SSR /auth/session 返回与日志关联
	Email string
	// Role 角色名（user/admin/superadmin），路由守卫据此判断权限
	Role string
	// RoleID 角色 id，细粒度权限查询（permission 表）需要
	RoleID int32
	// IsBuiltinSuperAdmin 是否内置超管，true 时权限检查短路放行所有权限码
	IsBuiltinSuperAdmin bool
}
