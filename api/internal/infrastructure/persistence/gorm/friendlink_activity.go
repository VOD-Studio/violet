package gorm

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domain "blog-api/internal/domain/friendlink"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func (r *FriendLinkRepository) FindApprovedPage(ctx context.Context, sort string, q shared.PageQuery) (shared.PageResult[*domain.FriendLink], error) {
	q = q.Normalize()
	order := "latest_published_at DESC NULLS LAST, sort_order ASC, id ASC"
	if sort == "manual" {
		order = "sort_order ASC, created_at DESC, id ASC"
	}
	query := r.db.WithContext(ctx).Model(&model.FriendLink{}).Where("status = ?", domain.StatusApproved)
	var rows []model.FriendLink
	total, err := countAndFind(query.Order(order), q, &rows, "公开友链")
	if err != nil {
		return shared.PageResult[*domain.FriendLink]{}, err
	}
	return shared.NewPageResult(q, friendlinkPOsToDomain(rows), total), nil
}

// ClaimRefreshBatch 用短事务领取到期项；多个实例不会同时抓同一条记录。
func (r *FriendLinkRepository) ClaimRefreshBatch(ctx context.Context, now time.Time, limit int) ([]*domain.FriendLink, error) {
	if limit < 1 || limit > 24 {
		limit = 24
	}
	var rows []model.FriendLink
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
			Where("status = ? AND next_refresh_at <= ?", domain.StatusApproved, now).
			Order("next_refresh_at ASC, id ASC").Limit(limit).Find(&rows).Error; err != nil {
			return err
		}
		for _, row := range rows {
			if err := tx.Model(&model.FriendLink{}).Where("id = ?", row.ID).
				UpdateColumn("next_refresh_at", now.Add(30*time.Minute)).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, shared.Internal("领取友链刷新任务失败", err)
	}
	return friendlinkPOsToDomain(rows), nil
}

func (r *FriendLinkRepository) SaveActivity(ctx context.Context, link *domain.FriendLink, activity domain.Activity) error {
	updates := map[string]any{
		"feed_status": activity.FeedStatus, "site_status": activity.SiteStatus, "checked_at": activity.CheckedAt,
	}
	// 失败只更新健康状态；保留最后成功文章及其真实日期。
	if activity.FeedStatus != domain.FeedError {
		updates["latest_title"] = activity.LatestTitle
		updates["latest_url"] = activity.LatestURL
		updates["latest_published_at"] = activity.LatestPublishedAt
	}
	err := r.db.WithContext(ctx).Model(&model.FriendLink{}).
		Where("id = ? AND status = ? AND url = ? AND rss_url = ?", link.ID().UUID(), domain.StatusApproved, link.URL(), link.RSSURL()).
		UpdateColumns(updates).Error
	if err != nil {
		return shared.Internal("保存友链抓取结果失败", err)
	}
	return nil
}

var _ domain.ActivityRepository = (*FriendLinkRepository)(nil)
