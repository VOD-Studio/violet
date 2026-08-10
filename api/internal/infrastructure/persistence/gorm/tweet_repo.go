package gorm

import (
	"context"
	"errors"
	"strings"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// TweetRepository 推文 GORM 实现。
type TweetRepository struct {
	db *gorm.DB
}

// NewTweetRepository 构造仓储。
func NewTweetRepository(db *gorm.DB) *TweetRepository {
	return &TweetRepository{db: db}
}

// Save 保存推文（按主键 upsert）。
//
// 推文不可编辑（聚合根无 Update），upsert 服务 T5 点赞计数（like_count）回写。
func (r *TweetRepository) Save(ctx context.Context, t *domaintweet.Tweet) error {
	po := tweetToPO(t)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存推文失败", err)
	}
	tags := t.Hashtags()
	if len(tags) > 0 {
		hashtags := make([]model.TweetHashtag, len(tags))
		for i, tag := range tags {
			hashtags[i] = model.TweetHashtag{
				TweetID:   t.ID().UUID(),
				Tag:       tag,
				CreatedAt: po.CreatedAt,
			}
		}
		if err := r.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&hashtags).Error; err != nil {
			return domainshared.Internal("保存推文话题关联失败", err)
		}
	}
	return nil
}

// FindByID 按 ID 查找推文。
func (r *TweetRepository) FindByID(ctx context.Context, id domainshared.ID) (*domaintweet.Tweet, error) {
	var po model.Tweet
	err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domaintweet.ErrNotFound
		}
		return nil, domainshared.Internal("查询推文失败", err)
	}
	return tweetToDomain(po)
}
// FindByIDs 批量按 ID 查找推文（服务 toDTOs 预加载引用推文）。
func (r *TweetRepository) FindByIDs(ctx context.Context, ids []domainshared.ID) ([]*domaintweet.Tweet, error) {
	if len(ids) == 0 {
		return []*domaintweet.Tweet{}, nil
	}
	uuids := make([]uuid.UUID, len(ids))
	for i, id := range ids {
		uuids[i] = id.UUID()
	}
	var pos []model.Tweet
	if err := r.db.WithContext(ctx).Where("id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("批量查询推文失败", err)
	}
	result := make([]*domaintweet.Tweet, 0, len(pos))
	for _, po := range pos {
		t, err := tweetToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

// FindByTopic 话题时间线：按话题标签过滤的 keyset 分页。
func (r *TweetRepository) FindByTopic(ctx context.Context, tag string, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	tag = strings.ToLower(strings.TrimSpace(tag))
	if tag == "" {
		return []*domaintweet.Tweet{}, nil
	}
	query := r.db.WithContext(ctx).
		Table("tweets").
		Select("tweets.*").
		Joins("JOIN tweet_hashtags ON tweets.id = tweet_hashtags.tweet_id").
		Where("tweet_hashtags.tag = ?", tag)

	if cursor != nil {
		query = query.Where(
			"tweets.created_at < ? OR (tweets.created_at = ? AND tweets.id < ?)",
			cursor.CreatedAt, cursor.CreatedAt, cursor.ID.UUID(),
		)
	}

	var pos []model.Tweet
	if err := query.Order("tweets.created_at DESC, tweets.id DESC").Limit(limit).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询话题推文列表失败", err)
	}

	result := make([]*domaintweet.Tweet, 0, len(pos))
	for _, po := range pos {
		t, err := tweetToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

// FindTimeline 全局时间线：按 (created_at, id) 倒序 keyset 分页（走 idx_tweets_timeline）。
func (r *TweetRepository) FindTimeline(ctx context.Context, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	return r.findPage(ctx, nil, cursor, limit)
}

// FindByAuthor 用户主页推文列表：按作者过滤的同构 keyset 分页（走 idx_tweets_author）。
func (r *TweetRepository) FindByAuthor(ctx context.Context, authorID domainshared.ID, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	return r.findPage(ctx, &authorID, cursor, limit)
}

// findPage keyset 分页共享实现。authorFilter 非 nil 时按作者过滤。
//
// 游标条件展开为 OR 形式而非行值 (created_at, id) < (?, ?)：
// 语义等价，且兼容 SQLite（仓储契约测试用 SQLite，见 repository_test.go 折中说明）。
func (r *TweetRepository) findPage(ctx context.Context, authorFilter *domainshared.ID, cursor *domaintweet.Cursor, limit int) ([]*domaintweet.Tweet, error) {
	query := r.db.WithContext(ctx).Model(&model.Tweet{})
	if authorFilter != nil {
		query = query.Where("author_id = ?", authorFilter.UUID())
	}
	if cursor != nil {
		query = query.Where(
			"created_at < ? OR (created_at = ? AND id < ?)",
			cursor.CreatedAt, cursor.CreatedAt, cursor.ID.UUID(),
		)
	}
	var pos []model.Tweet
	if err := query.Order("created_at DESC, id DESC").Limit(limit).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询推文时间线失败", err)
	}
	result := make([]*domaintweet.Tweet, 0, len(pos))
	for _, po := range pos {
		t, err := tweetToDomain(po)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, nil
}

// Delete 物理删除推文（点赞/评论由 DB ON DELETE CASCADE 连带清理）。
func (r *TweetRepository) Delete(ctx context.Context, id domainshared.ID) error {
	res := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Tweet{})
	if res.Error != nil {
		return domainshared.Internal("删除推文失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domaintweet.ErrNotFound
	}
	return nil
}
// Like 点赞推文（重复点赞幂等；推文不存在返回 ErrNotFound）。
func (r *TweetRepository) Like(ctx context.Context, tweetID, userID domainshared.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		err := tx.Model(&model.Tweet{}).Where("id = ?", tweetID.UUID()).Count(&count).Error
		if err != nil {
			return domainshared.Internal("查询推文失败", err)
		}
		if count == 0 {
			return domaintweet.ErrNotFound
		}

		like := model.TweetLike{
			TweetID: tweetID.UUID(),
			UserID:  userID.UUID(),
		}
		res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&like)
		if res.Error != nil {
			return domainshared.Internal("记录推文点赞关系失败", res.Error)
		}
		if res.RowsAffected == 0 {
			return nil
		}
		if err := tx.Model(&model.Tweet{}).Where("id = ?", tweetID.UUID()).UpdateColumn("like_count", gorm.Expr("like_count + 1")).Error; err != nil {
			return domainshared.Internal("更新推文点赞数失败", err)
		}
		return nil
	})
}

// Unlike 取消点赞推文（未点赞幂等，不报错）。
func (r *TweetRepository) Unlike(ctx context.Context, tweetID, userID domainshared.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("tweet_id = ? AND user_id = ?", tweetID.UUID(), userID.UUID()).Delete(&model.TweetLike{})
		if res.Error != nil {
			return domainshared.Internal("删除推文点赞关系失败", res.Error)
		}
		if res.RowsAffected == 0 {
			return nil
		}
		if err := tx.Model(&model.Tweet{}).Where("id = ?", tweetID.UUID()).UpdateColumn("like_count", gorm.Expr("CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END")).Error; err != nil {
			return domainshared.Internal("扣减推文点赞数失败", err)
		}
		return nil
	})
}

// IsLiked 查询指定用户是否已点赞某推文。
func (r *TweetRepository) IsLiked(ctx context.Context, tweetID, userID domainshared.ID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.TweetLike{}).Where("tweet_id = ? AND user_id = ?", tweetID.UUID(), userID.UUID()).Count(&count).Error
	if err != nil {
		return false, domainshared.Internal("查询点赞状态失败", err)
	}
	return count > 0, nil
}

// FindLikedTweetIDs 批量查询指定用户对推文列表的点赞状态集合。
func (r *TweetRepository) FindLikedTweetIDs(ctx context.Context, userID domainshared.ID, tweetIDs []domainshared.ID) (map[string]bool, error) {
	result := make(map[string]bool, len(tweetIDs))
	if len(tweetIDs) == 0 {
		return result, nil
	}
	uuids := make([]interface{}, 0, len(tweetIDs))
	for _, id := range tweetIDs {
		uuids = append(uuids, id.UUID())
	}
	var likedIDs []struct {
		TweetID string `gorm:"column:tweet_id"`
	}
	err := r.db.WithContext(ctx).Model(&model.TweetLike{}).Select("tweet_id").Where("user_id = ? AND tweet_id IN ?", userID.UUID(), uuids).Scan(&likedIDs).Error
	if err != nil {
		return nil, domainshared.Internal("批量查询点赞状态失败", err)
	}
	for _, item := range likedIDs {
		result[item.TweetID] = true
	}
	return result, nil
}
// CountQuotesByTweetIDs 批量查询推文列表的被引用次数。
func (r *TweetRepository) CountQuotesByTweetIDs(ctx context.Context, tweetIDs []domainshared.ID) (map[string]int64, error) {
	res := make(map[string]int64, len(tweetIDs))
	if len(tweetIDs) == 0 {
		return res, nil
	}
	uuids := make([]uuid.UUID, len(tweetIDs))
	for i, id := range tweetIDs {
		uuids[i] = id.UUID()
	}
	type countRow struct {
		QuoteOf uuid.UUID `gorm:"column:quote_of"`
		Cnt     int64     `gorm:"column:cnt"`
	}
	var rows []countRow
	err := r.db.WithContext(ctx).
		Table("tweets").
		Select("quote_of, COUNT(*) as cnt").
		Where("quote_of IN ?", uuids).
		Group("quote_of").
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量查询推文引用数失败", err)
	}
	for _, row := range rows {
		res[row.QuoteOf.String()] = row.Cnt
	}
	return res, nil
}

// tweetToPO 领域实体 → 持久化模型。
func tweetToPO(t *domaintweet.Tweet) model.Tweet {
	po := model.Tweet{
		ID:        t.ID().UUID(),
		AuthorID:  t.AuthorID().UUID(),
		Content:   t.Content(),
		Images:    datatypes.JSONSlice[string](t.Images()),
		LikeCount: t.LikeCount(),
	}
	if q := t.QuoteOf(); q != nil {
		u := q.UUID()
		po.QuoteOf = &u
	}
	if c := t.CreatedAt(); !c.IsZero() {
		po.CreatedAt = c
	}
	if u := t.UpdatedAt(); !u.IsZero() {
		po.UpdatedAt = u
	}
	return po
}

// tweetToDomain 持久化模型 → 领域实体。
func tweetToDomain(po model.Tweet) (*domaintweet.Tweet, error) {
	var quoteOf *domainshared.ID
	if po.QuoteOf != nil {
		id := domainshared.MustParseID(po.QuoteOf.String())
		quoteOf = &id
	}
	return domaintweet.ReconstructTweet(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Content,
		[]string(po.Images),
		quoteOf,
		po.LikeCount,
		po.CreatedAt,
		po.UpdatedAt,
	), nil
}

// 编译期断言：仓储实现满足领域接口。
var _ domaintweet.TweetRepository = (*TweetRepository)(nil)
