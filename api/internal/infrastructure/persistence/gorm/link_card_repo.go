package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainlink "blog-api/internal/domain/linkpreview"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// LinkCardRepository 链接卡片仓储 GORM 实现。
type LinkCardRepository struct {
	db *gorm.DB
}

// NewLinkCardRepository 构造仓储。
func NewLinkCardRepository(db *gorm.DB) *LinkCardRepository {
	return &LinkCardRepository{db: db}
}

// Save 保存卡片。并发抓取同一 URL 时按 url 冲突合并：后写者整体覆盖
// （应用层 singleflight 已合并绝大多数并发，这里兜底跨进程竞态）。
func (r *LinkCardRepository) Save(ctx context.Context, card *domainlink.LinkCard) error {
	po := linkCardToPO(card)
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "url"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "description", "site_name", "image_url", "status", "fetched_at", "expires_at", "last_error", "fail_count", "updated_at"}),
	}).Create(&po).Error
}

// FindByURLs 按 URL 批量查找。
func (r *LinkCardRepository) FindByURLs(ctx context.Context, urls []string) ([]*domainlink.LinkCard, error) {
	if len(urls) == 0 {
		return nil, nil
	}
	var pos []model.LinkCard
	if err := r.db.WithContext(ctx).Where("url IN ?", urls).Find(&pos).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	cards := make([]*domainlink.LinkCard, 0, len(pos))
	for _, po := range pos {
		cards = append(cards, linkCardToDomain(po))
	}
	return cards, nil
}

func linkCardToPO(c *domainlink.LinkCard) model.LinkCard {
	return model.LinkCard{
		ID: c.ID().UUID(), URL: c.URL(), Title: c.Title(),
		Description: c.Description(), SiteName: c.SiteName(), ImageURL: c.ImageURL(),
		Status: string(c.Status()), FetchedAt: c.FetchedAt(), ExpiresAt: c.ExpiresAt(),
		LastError: c.LastError(), FailCount: c.FailCount(),
		CreatedAt: c.CreatedAt(), UpdatedAt: c.UpdatedAt(),
	}
}

func linkCardToDomain(po model.LinkCard) *domainlink.LinkCard {
	return domainlink.ReconstructLinkCard(
		shared.IDFromUUID(po.ID), po.URL, po.Title, po.Description, po.SiteName, po.ImageURL,
		domainlink.Status(po.Status), po.FetchedAt, po.ExpiresAt, po.LastError, po.FailCount,
		po.CreatedAt, po.UpdatedAt,
	)
}

// 编译期断言：仓储实现满足领域接口。
var _ domainlink.LinkCardRepository = (*LinkCardRepository)(nil)
