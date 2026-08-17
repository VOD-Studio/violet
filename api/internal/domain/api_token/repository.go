package apitoken

import (
	"context"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// TokenLookup PAT 查找与使用记录端口，由 PAT 鉴权中间件依赖。
//
// 中间件只依赖端口，不直接依赖 DB，便于测试用 fake 替换（参考 SessionLookup）。
type TokenLookup interface {
	// FindByHash 按 token 哈希查找 PAT。找不到返回 ErrNotFound。
	FindByHash(ctx context.Context, hash string) (*PAT, error)
	// TouchLastUsed 刷新 last_used_at，失败不应阻塞请求（调用方异步调用并忽略错误）。
	TouchLastUsed(ctx context.Context, id string, now time.Time) error
}

// TokenRepository PAT 仓储接口。
type TokenRepository interface {
	// Save 创建 PAT（id 由聚合根生成）。
	Save(ctx context.Context, p *PAT) error
	// FindByHash 按 token 哈希查找（鉴权中间件用）。找不到返回 ErrNotFound。
	FindByHash(ctx context.Context, hash string) (*PAT, error)
	// FindByUser 列出某用户全部 PAT。
	FindByUser(ctx context.Context, userID string) ([]*PAT, error)
	// FindPageByUser 分页列出某用户 PAT（按创建时间倒序）。
	FindPageByUser(ctx context.Context, userID string, q domainshared.PageQuery) (domainshared.PageResult[*PAT], error)
	// Delete 删除（吊销）PAT。按 id + userID 双重定位，防越权删除他人 token。
	Delete(ctx context.Context, id, userID string) error
}

// 领域错误
var (
	ErrNotFound = domainshared.NotFound("访问令牌")
)
