// Package mcp 提供 MCP 传输层基础设施：PAT TokenVerifier（供 SDK 的
// auth.RequireBearerToken 复用）。
package mcp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/rs/zerolog/log"

	domainapitoken "blog-api/internal/domain/api_token"
)

// PATVerifier 把博客 PAT 适配为 MCP SDK 的 auth.TokenVerifier。
//
// 流程：明文 token → SHA-256 哈希 → TokenLookup.FindByHash → 校验未过期 →
// 返回 auth.TokenInfo（UserID + Scopes + Expiration）。
// 找不到或已过期返回 auth.ErrInvalidToken（SDK 中间件据此回 401）。
// 成功路径异步刷新 last_used_at（独立 ctx，不阻塞请求；失败仅记日志）。
type PATVerifier struct {
	lookup domainapitoken.TokenLookup
}

// NewPATVerifier 构造 PAT 校验器。
func NewPATVerifier(lookup domainapitoken.TokenLookup) *PATVerifier {
	return &PATVerifier{lookup: lookup}
}

// Verify 实现 auth.TokenVerifier。
func (v *PATVerifier) Verify(ctx context.Context, token string, _ *http.Request) (*auth.TokenInfo, error) {
	p, err := v.lookup.FindByHash(ctx, domainapitoken.HashToken(token))
	if err != nil {
		if errors.Is(err, domainapitoken.ErrNotFound) {
			return nil, fmt.Errorf("%w: 令牌无效", auth.ErrInvalidToken)
		}
		return nil, err
	}
	if p.IsExpired(time.Now()) {
		return nil, fmt.Errorf("%w: 令牌已过期", auth.ErrInvalidToken)
	}
	// 异步刷新 last_used_at：独立 ctx（不复用请求 ctx），不阻塞响应。
	go func(id string) {
		tctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := v.lookup.TouchLastUsed(tctx, id, time.Now()); err != nil {
			log.Warn().Err(err).Str("token_id", id).Msg("刷新 PAT last_used_at 失败")
		}
	}(p.ID())

	return &auth.TokenInfo{
		UserID:     p.UserID(),
		Scopes:     p.Scopes(),
		Expiration: p.ExpiresAt(), // 零值 = 永不过期
	}, nil
}
