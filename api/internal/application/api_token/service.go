// Package apitoken 提供 PAT（个人访问令牌）的应用层用例。
package apitoken

import (
	"context"
	"time"

	domainapitoken "blog-api/internal/domain/api_token"
)

// Service PAT 应用服务。
type Service struct {
	repo domainapitoken.TokenRepository
}

// NewService 创建 PAT 应用服务。
func NewService(repo domainapitoken.TokenRepository) *Service {
	return &Service{repo: repo}
}

// CreateInput 创建 PAT 入参。
type CreateInput struct {
	UserID     string
	Name       string
	Scopes     []string
	ExpiresAt  time.Time // 零值表示永不过期
}

// CreateResult 创建结果。Token 为明文，仅此一次返回。
type CreateResult struct {
	Token PATDTO // 明文 token 在 DTO.PlaintextToken 中，仅创建时非空
}

// Create 创建 PAT，返回明文 token（仅此一次）。
func (s *Service) Create(ctx context.Context, in CreateInput) (CreateResult, error) {
	p, plaintext, err := domainapitoken.NewPAT(in.UserID, in.Name, in.Scopes, in.ExpiresAt, time.Now())
	if err != nil {
		return CreateResult{}, err
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return CreateResult{}, err
	}
	return CreateResult{Token: toDTO(p, plaintext)}, nil
}

// List 列出某用户的全部 PAT（不含明文）。
func (s *Service) List(ctx context.Context, userID string) ([]PATDTO, error) {
	pats, err := s.repo.FindByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]PATDTO, 0, len(pats))
	for _, p := range pats {
		out = append(out, toDTO(p, ""))
	}
	return out, nil
}

// Delete 吊销 PAT。按 id + userID 双重定位，防越权。
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	return s.repo.Delete(ctx, id, userID)
}

// PATDTO PAT 读模型。
type PATDTO struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Scopes         []string `json:"scopes"`
	ExpiresAt      string   `json:"expires_at,omitempty"`     // 空表示永不过期
	LastUsedAt     string   `json:"last_used_at,omitempty"`   // 空表示从未使用
	CreatedAt      string   `json:"created_at"`
	PlaintextToken string   `json:"token,omitempty"`          // 明文 token（一次性，仅创建响应非空）；列表及其他场景恒为空
}

func toDTO(p *domainapitoken.PAT, plaintext string) PATDTO {
	dto := PATDTO{
		ID:   p.ID(),
		Name: p.Name(),
		Scopes: p.Scopes(),
		CreatedAt: p.CreatedAt().Format(time.RFC3339),
		PlaintextToken: plaintext,
	}
	if !p.ExpiresAt().IsZero() {
		dto.ExpiresAt = p.ExpiresAt().Format(time.RFC3339)
	}
	if !p.LastUsedAt().IsZero() {
		dto.LastUsedAt = p.LastUsedAt().Format(time.RFC3339)
	}
	return dto
}
