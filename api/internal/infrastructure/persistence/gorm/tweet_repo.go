package gorm

import (
	"context"
	"errors"

	"gorm.io/datatypes"
	"gorm.io/gorm"

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

// tweetToPO 领域实体 → 持久化模型。
func tweetToPO(t *domaintweet.Tweet) model.Tweet {
	po := model.Tweet{
		ID:        t.ID().UUID(),
		AuthorID:  t.AuthorID().UUID(),
		Content:   t.Content(),
		Images:    datatypes.JSONSlice[string](t.Images()),
		LikeCount: t.LikeCount(),
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
	return domaintweet.ReconstructTweet(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Content,
		[]string(po.Images),
		po.LikeCount,
		po.CreatedAt,
		po.UpdatedAt,
	), nil
}

// 编译期断言：仓储实现满足领域接口。
var _ domaintweet.TweetRepository = (*TweetRepository)(nil)
