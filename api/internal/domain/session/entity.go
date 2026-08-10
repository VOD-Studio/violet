package session

import (
	"errors"
	"time"
)

// ErrSessionNotFound session 不存在或已过期。
//
// SessionStore.Get 在 Redis 无此 key 时返回本错误，调用方（鉴权中间件、
// /auth/session 端点）应将其映射为 401，触发前端重登。
var ErrSessionNotFound = errors.New("session not found")

// Claims 鉴权中间件与 /auth/session 端点返回的身份字段。
//
// 鉴权中间件用 context key 注入这些字段，下游 handler 通过 getter 读取。
// CSRFToken 随 claims 一起返回，供需要写操作的端点校验。
type Claims struct {
	// UserID 用户唯一标识
	UserID string
	// Email 用户邮箱
	Email string
	// Role 角色名
	Role string
	// IsRoot root 用户标志位
	IsRoot bool
	// CSRFToken double-submit CSRF 凭证
	CSRFToken string
}

// Session opaque session 聚合根。
//
// 不变量（Invariant）：
//   - id 创建后永不变：续期只更新 lastSeenAt 与 Redis TTL，绝不轮换 id
//     （命门不变量②；一旦轮换 id 就要在 SSR 写 Set-Cookie，重新撞透传卡点）
//   - 过期权威由两套机制取先到者：
//       idle：lastSeenAt + idleTTL（滑动窗口，活跃用户不过期）
//       max：absoluteDeadline（若 max>0 时设置；登录起算的硬上限）
//
// 聚合根只做纯领域逻辑（IsExpired/Touch/Claims），不访问 Redis；
// 持久化由 SessionStore 完成。
type Session struct {
	// id opaque session 标识，创建后永不变
	id ID
	// userID 用户唯一标识（string 形式，来自 UserSnapshot.UserID.String()）
	userID string
	// email 用户邮箱
	email string
	// role 角色名
	role string
	// isRoot root 用户标志位
	isRoot bool
	// csrf double-submit CSRF 凭证，与 violet_csrf cookie 同值
	csrf CSRFToken
	// createdAt session 创建时间，用于计算绝对寿命是否到点
	createdAt time.Time
	// lastSeenAt 最近一次活跃时间，idle 滑动续期的基准
	lastSeenAt time.Time
	// absoluteDeadline 绝对寿命截止时间；零值表示无绝对上限（max<=0）
	absoluteDeadline time.Time
}

// NewSession 创建新 session。
//
// now 为当前时间（由调用方注入，便于测试）；absoluteTTL<=0 表示无绝对寿命上限
// （absoluteDeadline 保持零值）。生成唯一 id 与独立 csrf token。
// 随机源失败时返回错误，调用方应映射为 500。
func NewSession(snap UserSnapshot, now time.Time, absoluteTTL time.Duration) (*Session, error) {
	id, err := NewID()
	if err != nil {
		return nil, err
	}
	csrf, err := NewCSRFToken()
	if err != nil {
		return nil, err
	}
	s := &Session{
		id:                  id,
		userID:              snap.UserID.String(),
		email:               snap.Email,
		role:                snap.Role,
		isRoot:             snap.IsRoot,
		csrf:                csrf,
		createdAt:           now,
		lastSeenAt:          now,
	}
	if absoluteTTL > 0 {
		s.absoluteDeadline = now.Add(absoluteTTL)
	}
	return s, nil
}

// Reconstruct 从持久化数据重建 session 聚合。
//
// 与 NewUser 的 ReconstructUser 同理：不触发事件、不设默认值，完全按 Redis
// 存储的数据恢复。供 SessionStore.Get 反序列化时使用。
func Reconstruct(
	id ID, userID, email, role string, isRoot bool,
	csrf CSRFToken, createdAt, lastSeenAt, absoluteDeadline time.Time,
) *Session {
	return &Session{
		id:                  id,
		userID:              userID,
		email:               email,
		role:                role,
		isRoot:             isRoot,
		csrf:                csrf,
		createdAt:           createdAt,
		lastSeenAt:          lastSeenAt,
		absoluteDeadline:    absoluteDeadline,
	}
}

// ID 返回 session 标识（创建后永不变）。
func (s *Session) ID() ID { return s.id }

// UserID 返回用户唯一标识。
func (s *Session) UserID() string { return s.userID }

// CSRF 返回 CSRF token。
func (s *Session) CSRF() CSRFToken { return s.csrf }

// CreatedAt 返回创建时间。
func (s *Session) CreatedAt() time.Time { return s.createdAt }

// LastSeenAt 返回最近活跃时间。
func (s *Session) LastSeenAt() time.Time { return s.lastSeenAt }

// AbsoluteDeadline 返回绝对寿命截止时间，零值表示无上限。
func (s *Session) AbsoluteDeadline() time.Time { return s.absoluteDeadline }

// Claims 返回鉴权所需的身份字段快照。
//
// 供鉴权中间件注入 context、/auth/session 端点返回给 SSR。
func (s *Session) Claims() Claims {
	return Claims{
		UserID:              s.userID,
		Email:               s.email,
		Role:                s.role,
		IsRoot:             s.isRoot,
		CSRFToken:           string(s.csrf),
	}
}

// Touch 滑动续期：更新最近活跃时间为 now。
//
// 命门不变量②：只更新 lastSeenAt，**不轮换 id、不产生 cookie**。
// SessionStore.Touch 会在调用本方法后把新 lastSeenAt 持久化并重置 Redis TTL。
func (s *Session) Touch(now time.Time) {
	s.lastSeenAt = now
}

// IsExpired 判断 session 是否已过期。
//
// 过期权威 = min(idle 到期, 绝对到期[若启用])，任一满足即过期：
//   - idle 到期：now - lastSeenAt > idleTTL（空闲超时）
//   - 绝对到期：absoluteDeadline 非零值且 now 在其后（硬上限，无论多活跃）
//
// idleTTL 由 config.Session.IdleTTL 注入。
func (s *Session) IsExpired(now time.Time, idleTTL time.Duration) bool {
	if now.Sub(s.lastSeenAt) > idleTTL {
		return true
	}
	if !s.absoluteDeadline.IsZero() && now.After(s.absoluteDeadline) {
		return true
	}
	return false
}
