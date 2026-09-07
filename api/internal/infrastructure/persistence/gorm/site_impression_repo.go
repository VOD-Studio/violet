package gorm

import (
	"context"

	"blog-api/internal/domain/shared"
	domainsiteimpression "blog-api/internal/domain/siteimpression"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SiteImpressionRepository 只接受 HMAC 摘要，不接触原始设备令牌。
type SiteImpressionRepository struct {
	db *gorm.DB
}

// NewSiteImpressionRepository 绑定数据库句柄。
func NewSiteImpressionRepository(db *gorm.DB) *SiteImpressionRepository {
	return &SiteImpressionRepository{db: db}
}

var _ domainsiteimpression.Repository = (*SiteImpressionRepository)(nil)

// Ensure 依靠 token_hash 主键实现重复和并发请求幂等。
func (r *SiteImpressionRepository) Ensure(ctx context.Context, hash domainsiteimpression.TokenHash) error {
	row := model.SiteImpression{TokenHash: hash[:]}
	if err := r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
		return shared.Internal("保存匿名设备印记失败", err)
	}
	return nil
}

// Count 返回当前去重设备总数。
func (r *SiteImpressionRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Model(&model.SiteImpression{}).Count(&count).Error; err != nil {
		return 0, shared.Internal("统计匿名设备印记失败", err)
	}
	return count, nil
}

// Contains 判断当前摘要是否已经存在。
func (r *SiteImpressionRepository) Contains(ctx context.Context, hash domainsiteimpression.TokenHash) (bool, error) {
	var exists bool
	if err := r.db.WithContext(ctx).
		Raw("SELECT EXISTS (SELECT 1 FROM site_impressions WHERE token_hash = ?)", hash[:]).
		Scan(&exists).Error; err != nil {
		return false, shared.Internal("查询匿名设备印记失败", err)
	}
	return exists, nil
}
