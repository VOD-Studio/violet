package apitoken

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// PAT scope 枚举。固定七分：文章读/写/发布、抓取、订阅读/写、评论读，创建时多选。
const (
	ScopePostsRead          = "posts:read"
	ScopePostsWrite         = "posts:write"
	ScopePostsPublish       = "posts:publish"
	ScopePostsScrape        = "posts:scrape"        // 抓取外站文章（scrape_url tool），SSRF 风险点，独立回收权限
	ScopeSubscriptionsRead  = "subscriptions:read"  // 列/查订阅源
	ScopeSubscriptionsWrite = "subscriptions:write" // 增删改订阅源、暂停/恢复
	ScopeCommentsRead       = "comments:read"       // 评论/批注检索（MCP violet-comments server）
)

// validScopes 合法 scope 集合，校验与新增 scope 时同步此处 + 前端 PAT_SCOPES 常量
// （本仓库 PAT scope 不入 DB seed，校验在创建/查询时即时做）。
var validScopes = map[string]struct{}{
	ScopePostsRead:          {},
	ScopePostsWrite:         {},
	ScopePostsPublish:       {},
	ScopePostsScrape:        {},
	ScopeSubscriptionsRead:  {},
	ScopeSubscriptionsWrite: {},
	ScopeCommentsRead:       {},
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
	// id PAT 标识（持久化主键，如 ULID）
	id string
	// userID 所属用户 ID
	userID string
	// name 用户自命名（便于区分多个 PAT）
	name string
	// tokenHash 令牌哈希（创建后永不变；明文仅在创建时一次性返回，库中只存哈希）
	tokenHash string
	// scopes 授权 scope 列表（创建时声明的子集，HasScope 按子集判定）
	scopes []string
	// expiresAt 过期时间（零值表示永不过期；非零值时与 now 比较判过期）
	expiresAt time.Time
	// lastUsedAt 最近一次使用时间（零值表示从未使用，每次鉴权成功后更新）
	lastUsedAt time.Time
	// createdAt 创建时间
	createdAt time.Time
}

// NewPAT 创建新 PAT。返回聚合根与 token 哈希（明文由调用方保留并一次性返回）。
//
// expiresAt 零值表示永不过期；非零值时与 now 比较判过期。
// 随机源失败返回错误，调用方映射为 500。
func NewPAT(userID, name string, scopes []string, expiresAt, now time.Time) (*PAT, string, error) {
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
		expiresAt: expiresAt,
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

func (p *PAT) ID() string            { return p.id }
func (p *PAT) UserID() string        { return p.userID }
func (p *PAT) Name() string          { return p.name }
func (p *PAT) TokenHash() string     { return p.tokenHash }
func (p *PAT) Scopes() []string      { return p.scopes }
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
