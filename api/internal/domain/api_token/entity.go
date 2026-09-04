package apitoken

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// PAT scope 枚举。固定十分：文章读/写/发布、抓取、订阅读/写、评论读、笔记读/写/发布，创建时多选。
const (
	ScopePostsRead          = "posts:read"
	ScopePostsWrite         = "posts:write"
	ScopePostsPublish       = "posts:publish"
	ScopePostsScrape        = "posts:scrape"        // 抓取外站文章（scrape_url tool），SSRF 风险点，独立回收权限
	ScopeSubscriptionsRead  = "subscriptions:read"  // 列/查订阅源
	ScopeSubscriptionsWrite = "subscriptions:write" // 增删改订阅源、暂停/恢复
	ScopeCommentsRead       = "comments:read"       // 评论/批注检索（MCP violet-comments server）
	ScopeNotesRead          = "notes:read"          // 列/查自己的笔记含草稿（MCP violet-notes server）
	ScopeNotesWrite         = "notes:write"         // 创建/编辑/删除自己的笔记
	ScopeNotesPublish       = "notes:publish"       // 以 published 状态建笔记（直发；draft 不需要）
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
	ScopeNotesRead:          {},
	ScopeNotesWrite:         {},
	ScopeNotesPublish:       {},
}

// IsValidScope 判断 scope 是否在预定义枚举内。
func IsValidScope(s string) bool {
	_, ok := validScopes[s]
	return ok
}

// PATCreated PAT 已创建事件
//
// 凭据生命周期应审计。Name 为 PAT 名称快照。
type PATCreated struct {
	domainshared.BaseEvent
	// Name PAT 名称
	Name string
}

// NewPATCreated 构造 PAT 创建事件
func NewPATCreated(userID domainshared.ID, name string) PATCreated {
	return PATCreated{
		BaseEvent: domainshared.NewBaseEvent("api_token.created", userID),
		Name:      name,
	}
}

// PATDeleted PAT 已删除事件
type PATDeleted struct {
	domainshared.BaseEvent
	// Name PAT 名称（删除前快照，删除时从 repo 加载）
	Name string
}

// NewPATDeleted 构造 PAT 删除事件
func NewPATDeleted(userID domainshared.ID, name string) PATDeleted {
	return PATDeleted{
		BaseEvent: domainshared.NewBaseEvent("api_token.deleted", userID),
		Name:      name,
	}
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
	// interactive MCP 写 tool 交互偏好：true（默认）= 冲突/命名场景返回候选
	// 让 agent 转述用户；false = 一路到底，可安全推荐的分叉按推荐项自动决策。
	// 是体验偏好不是权限：scope 门禁与 owner 校验不受影响。
	interactive bool
	// createdAt 创建时间
	createdAt time.Time
}

// PATOption NewPAT 的可选配置。
type PATOption func(*PAT)

// WithInteractive 声明交互偏好（默认 true）。
func WithInteractive(v bool) PATOption {
	return func(p *PAT) { p.interactive = v }
}

// NewPAT 创建新 PAT。返回聚合根与 token 哈希（明文由调用方保留并一次性返回）。
//
// expiresAt 零值表示永不过期；非零值时与 now 比较判过期。
// 随机源失败返回错误，调用方映射为 500。
func NewPAT(userID, name string, scopes []string, expiresAt, now time.Time, opts ...PATOption) (*PAT, string, error) {
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
		id:          domainshared.NewID().String(),
		userID:      userID,
		name:        name,
		tokenHash:   HashToken(raw),
		scopes:      scopes,
		expiresAt:   expiresAt,
		interactive: true,
		createdAt:   now,
	}
	for _, opt := range opts {
		opt(p)
	}
	return p, raw, nil
}

// Reconstruct 从持久化数据重建 PAT 聚合（不触发事件、不设默认值）。
func Reconstruct(id, userID, name, tokenHash string, scopes []string, expiresAt, lastUsedAt, createdAt time.Time, interactive bool) *PAT {
	return &PAT{
		id: id, userID: userID, name: name, tokenHash: tokenHash,
		scopes: scopes, expiresAt: expiresAt, lastUsedAt: lastUsedAt, createdAt: createdAt,
		interactive: interactive,
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
func (p *PAT) Interactive() bool     { return p.interactive }

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
