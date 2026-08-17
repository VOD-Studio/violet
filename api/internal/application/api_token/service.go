// Package apitoken 提供 PAT（个人访问令牌）的应用层用例。
package apitoken

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	appshared "blog-api/internal/application/shared"
	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/domain/shared"
)

// Service PAT 应用服务。
type Service struct {
	repo domainapitoken.TokenRepository
	bus  appshared.EventBus
}

// NewService 创建 PAT 应用服务。
func NewService(repo domainapitoken.TokenRepository, bus appshared.EventBus) *Service {
	return &Service{repo: repo, bus: bus}
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
	// PAT 是简单实体无聚合事件，应用层手动构造发布（凭据生命周期审计）
	uid, err := shared.ParseID(p.UserID())
	if err == nil {
		if err := s.bus.Publish(ctx, []shared.DomainEvent{domainapitoken.NewPATCreated(uid, p.Name())}); err != nil {
			log.Warn().Err(err).Msg("发布 PAT 创建事件失败")
		}
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

// ListPage 分页列出某用户 PAT（不含明文）。
func (s *Service) ListPage(ctx context.Context, userID string, q shared.PageQuery) (shared.PageResult[PATDTO], error) {
	result, err := s.repo.FindPageByUser(ctx, userID, q)
	if err != nil {
		return shared.PageResult[PATDTO]{}, err
	}
	out := make([]PATDTO, 0, len(result.Items))
	for _, p := range result.Items {
		out = append(out, toDTO(p, ""))
	}
	return shared.NewPageResult(shared.PageQuery{Page: result.Page, Limit: result.Limit}, out, result.Total), nil
}

// Delete 吊销 PAT。按 id + userID 双重定位，防越权。
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	// 删除前先查 name（删除后无法追溯）
	name := ""
	if pats, err := s.repo.FindByUser(ctx, userID); err == nil {
		for _, p := range pats {
			if p.ID() == id {
				name = p.Name()
				break
			}
		}
	}
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}
	uid, err := shared.ParseID(userID)
	if err == nil {
		if err := s.bus.Publish(ctx, []shared.DomainEvent{domainapitoken.NewPATDeleted(uid, name)}); err != nil {
			log.Warn().Err(err).Msg("发布 PAT 删除事件失败")
		}
	}
	return nil
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
