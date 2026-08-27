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

	// 永不过期的 PAT（expiresAt 零值）不能原样透传给 SDK：
	// auth.RequireBearerToken 要求 Expiration 非零，否则 401 "token missing expiration"。
	// 投影为当前时间 +100 年，远超任何合理 token 寿命，语义上等价于永不过期。
	exp := p.ExpiresAt()
	if exp.IsZero() {
		exp = time.Now().AddDate(100, 0, 0)
	}
	return &auth.TokenInfo{
		UserID:     p.UserID(),
		Scopes:     p.Scopes(),
		Expiration: exp,
		Extra: map[string]any{
			// PAT 级 MCP 交互偏好（#272）：tool handler 经 tokenInfo 读取，
			// false = 写操作一路到底，可安全推荐的分叉按推荐项自动决策
			"interactive": p.Interactive(),
		},
	}, nil
}

// Interactive 从 TokenInfo.Extra 读取 PAT 交互偏好；缺失时保守默认 true。
// tool handler 用它决定冲突分叉是返回候选（agent 转述用户）还是自动决策。
func Interactive(ti *auth.TokenInfo) bool {
	if ti == nil || ti.Extra == nil {
		return true
	}
	if v, ok := ti.Extra["interactive"].(bool); ok {
		return v
	}
	return true
}
