package apitoken

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// PAT scope 枚举。固定三分：读 / 写 / 发布，创建时多选。
const (
	ScopePostsRead   = "posts:read"
	ScopePostsWrite  = "posts:write"
	ScopePostsPublish = "posts:publish"
)

// validScopes 合法 scope 集合，校验与新增 scope 时三处同步（此处 + DB + 前端类型）。
var validScopes = map[string]struct{}{
	ScopePostsRead:    {},
	ScopePostsWrite:   {},
	ScopePostsPublish: {},
}

// IsValidScope 判断 scope 是否在预定义枚举内。
func IsValidScope(s string) bool {
	_, ok := validScopes[s]
	return ok
}

// PAT 个人访问令牌聚合根。
//
// 不变量：
//   - tokenHash 创建后永不变（明文仅在创建时返回一次，库中只存哈希）
//   - expiresAt 零值表示永不过期；非零值时与 now 比较判过期
//   - scopes 是创建时声明的写权限子集，校验时按子集判定
//
// 聚合根只做纯领域逻辑（HasScope/IsExpired），不访问 DB；
// 持久化由 TokenRepository 完成。
type PAT struct {
	id        string
	userID    string
	name      string
	tokenHash string
	scopes    []string
	expiresAt time.Time // 零值 = 永不过期
	lastUsedAt time.Time
	createdAt time.Time
}

// NewPAT 创建新 PAT。返回聚合根与 token 哈希（明文由调用方保留并一次性返回）。
//
// ttl<=0 表示永不过期（expiresAt 保持零值）；ttl>0 时 expiresAt = now + ttl。
// 随机源失败返回错误，调用方映射为 500。
func NewPAT(userID, name string, scopes []string, ttl time.Duration, now time.Time) (*PAT, string, error) {
	if len(scopes) == 0 {
		return nil, "", domainshared.BadRequest("至少选择一个权限范围")
	}
	for _, s := range scopes {
		if !IsValidScope(s) {
			return nil, "", domainshared.BadRequest("未知的权限范围: " + s)
		}
	}
	raw, err := GenerateToken()
	if err != nil {
		return nil, "", domainshared.Internal("生成 token 失败", err)
	}
	p := &PAT{
		id:        domainshared.NewID().String(),
		userID:    userID,
		name:      name,
		tokenHash: HashToken(raw),
		scopes:    scopes,
		expiresAt: expiryFromTTL(ttl, now),
		createdAt: now,
	}
	return p, raw, nil
}

// Reconstruct 从持久化数据重建 PAT 聚合（不触发事件、不设默认值）。
func Reconstruct(id, userID, name, tokenHash string, scopes []string, expiresAt, lastUsedAt, createdAt time.Time) *PAT {
	return &PAT{
		id: id, userID: userID, name: name, tokenHash: tokenHash,
		scopes: scopes, expiresAt: expiresAt, lastUsedAt: lastUsedAt, createdAt: createdAt,
	}
}

func expiryFromTTL(ttl time.Duration, now time.Time) time.Time {
	if ttl <= 0 {
		return time.Time{}
	}
	return now.Add(ttl)
}

func (p *PAT) ID() string         { return p.id }
func (p *PAT) UserID() string     { return p.userID }
func (p *PAT) Name() string       { return p.name }
func (p *PAT) TokenHash() string  { return p.tokenHash }
func (p *PAT) Scopes() []string   { return p.scopes }
func (p *PAT) ExpiresAt() time.Time  { return p.expiresAt }
func (p *PAT) LastUsedAt() time.Time { return p.lastUsedAt }
func (p *PAT) CreatedAt() time.Time  { return p.createdAt }

// HasScope 判断该 PAT 是否拥有指定 scope（子集判定）。
func (p *PAT) HasScope(scope string) bool {
	for _, s := range p.scopes {
		if s == scope {
			return true
		}
	}
	return false
}

// IsExpired 判断是否已过期。
// expiresAt 零值 = 永不过期；否则 now >= expiresAt 即过期。
func (p *PAT) IsExpired(now time.Time) bool {
	if p.expiresAt.IsZero() {
		return false
	}
	return !now.Before(p.expiresAt)
}
