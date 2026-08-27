package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	domainapitoken "blog-api/internal/domain/api_token"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// APITokenRepository GORM 实现的 PAT 仓储。
//
// 同时实现 domain/apitoken.TokenRepository 与 TokenLookup（FindByHash + TouchLastUsed），
// 供 PAT 鉴权中间件依赖。
type APITokenRepository struct {
	db *gorm.DB
}

// NewAPITokenRepository 创建 PAT 仓储。
func NewAPITokenRepository(db *gorm.DB) *APITokenRepository {
	return &APITokenRepository{db: db}
}

// Save 创建 PAT。
func (r *APITokenRepository) Save(ctx context.Context, p *domainapitoken.PAT) error {
	return r.db.WithContext(ctx).Create(tokenToPO(p)).Error
}

// FindByHash 按 token 哈希查找。找不到返回 ErrNotFound。
func (r *APITokenRepository) FindByHash(ctx context.Context, hash string) (*domainapitoken.PAT, error) {
	var po model.APIToken
	err := r.db.WithContext(ctx).
		Where("token_hash = ?", hash).
		First(&po).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainapitoken.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return tokenToDomain(po)
}

// FindByUser 列出某用户全部 PAT（按创建时间倒序）。
func (r *APITokenRepository) FindByUser(ctx context.Context, userID string) ([]*domainapitoken.PAT, error) {
	var pos []model.APIToken
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&pos).Error
	if err != nil {
		return nil, err
	}
	out := make([]*domainapitoken.PAT, 0, len(pos))
	for _, po := range pos {
		p, err := tokenToDomain(po)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// FindPageByUser 分页列出某用户 PAT（按创建时间倒序，id 作 tiebreaker）。
func (r *APITokenRepository) FindPageByUser(ctx context.Context, userID string, q domainshared.PageQuery) (domainshared.PageResult[*domainapitoken.PAT], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.APIToken{}).
		Where("user_id = ?", userID).
		Order("created_at DESC, id ASC")
	var pos []model.APIToken
	total, err := countAndFind(query, q, &pos, "访问令牌")
	if err != nil {
		return domainshared.PageResult[*domainapitoken.PAT]{}, err
	}
	out := make([]*domainapitoken.PAT, 0, len(pos))
	for _, po := range pos {
		p, err := tokenToDomain(po)
		if err != nil {
			return domainshared.PageResult[*domainapitoken.PAT]{}, err
		}
		out = append(out, p)
	}
	return domainshared.NewPageResult(q, out, total), nil
}

// Delete 删除（吊销）PAT。按 id + userID 双重定位，防越权删除他人 token。
func (r *APITokenRepository) Delete(ctx context.Context, id, userID string) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&model.APIToken{}).Error
}

// TouchLastUsed 刷新 last_used_at。用于 PAT 鉴权中间件。
func (r *APITokenRepository) TouchLastUsed(ctx context.Context, id string, now time.Time) error {
	return r.db.WithContext(ctx).
		Model(&model.APIToken{}).
		Where("id = ?", id).
		Update("last_used_at", now).Error
}

// tokenToPO 领域实体 → 持久化模型。
func tokenToPO(p *domainapitoken.PAT) *model.APIToken {
	po := &model.APIToken{
		ID:        p.ID(),
		UserID:    p.UserID(),
		Name:      p.Name(),
		TokenHash: p.TokenHash(),
		Scopes:    datatypes.JSONSlice[string](p.Scopes()),
		CreatedAt: p.CreatedAt(),
	}
	if !p.ExpiresAt().IsZero() {
		exp := p.ExpiresAt()
		po.ExpiresAt = &exp
	}
	if !p.LastUsedAt().IsZero() {
		lu := p.LastUsedAt()
		po.LastUsedAt = &lu
	}
	interactive := p.Interactive()
	po.Interactive = &interactive
	return po
}

// tokenToDomain 持久化模型 → 领域实体。
func tokenToDomain(po model.APIToken) (*domainapitoken.PAT, error) {
	var expires, lastUsed time.Time
	if po.ExpiresAt != nil {
		expires = *po.ExpiresAt
	}
	if po.LastUsedAt != nil {
		lastUsed = *po.LastUsedAt
	}
	scopes := []string(po.Scopes)
	interactive := true
	if po.Interactive != nil {
		interactive = *po.Interactive
	}
	return domainapitoken.Reconstruct(
		po.ID, po.UserID, po.Name, po.TokenHash,
		scopes, expires, lastUsed, po.CreatedAt, interactive,
	), nil
}

// 编译期断言：APITokenRepository 实现领域端口
var (
	_ domainapitoken.TokenRepository = (*APITokenRepository)(nil)
	_ domainapitoken.TokenLookup     = (*APITokenRepository)(nil)
)
