package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"gorm.io/gorm"
	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// TweetCommentRepository 推文评论 GORM 实现。
type TweetCommentRepository struct {
	db *gorm.DB
}

// NewTweetCommentRepository 构造仓储。
func NewTweetCommentRepository(db *gorm.DB) *TweetCommentRepository {
	return &TweetCommentRepository{db: db}
}

// Save 保存评论（按主键 upsert）。
func (r *TweetCommentRepository) Save(ctx context.Context, c *domaintweet.Comment) error {
	po := tweetCommentToPO(c)
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存推文评论失败", err)
	}
	return nil
}

// FindByID 按 ID 查找评论。
func (r *TweetCommentRepository) FindByID(ctx context.Context, id domainshared.ID) (*domaintweet.Comment, error) {
	var po model.TweetComment
	err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domaintweet.ErrCommentNotFound
		}
		return nil, domainshared.Internal("查询推文评论失败", err)
	}
	return tweetCommentToDomain(po), nil
}

// FindPage 分页列出推文评论（统一入口；筛选与排序语义见 domaintweet.ListFilter）。
//
// TweetID 场景返回顶层评论（depth=0）；ParentID 场景先查 parent 拿 path（顶层
// 评论 path 形如 "<uuid>/"），再按 path 前缀查所有回复（path LIKE "<uuid>/%"），
// 排除 parent 自身。两层扁平下回复的 parent_id 可能指另一条回复，但 path 都挂
// 同一顶层，所以按 path 前缀能把「回复 @yyy」整条链都拉出来。
func (r *TweetCommentRepository) FindPage(ctx context.Context, filter domaintweet.ListFilter, q domainshared.PageQuery) (domainshared.PageResult[*domaintweet.Comment], error) {
	q = q.Normalize()
	query := r.db.WithContext(ctx).Model(&model.TweetComment{})
	if filter.ParentID != nil {
		var parent model.TweetComment
		if err := r.db.WithContext(ctx).First(&parent, "id = ?", filter.ParentID.UUID()).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domainshared.PageResult[*domaintweet.Comment]{}, domaintweet.ErrCommentNotFound
			}
			return domainshared.PageResult[*domaintweet.Comment]{}, domainshared.Internal("查询父评论失败", err)
		}
		query = query.Where("path LIKE ?", parent.Path+"%").
			Where("id != ?", filter.ParentID.UUID())
	} else if filter.TweetID != nil {
		query = query.Where("tweet_id = ? AND depth = 0", filter.TweetID.UUID())
	}
	var pos []model.TweetComment
	total, err := countAndFind(query.Order(tweetCommentPageOrder(filter)), q, &pos, "推文评论")
	if err != nil {
		return domainshared.PageResult[*domaintweet.Comment]{}, err
	}
	return domainshared.NewPageResult(q, tweetCommentPOsToDomain(pos), total), nil
}

// tweetCommentPageOrder 由 filter 决定页内排序（均带唯一列 tiebreaker，防 offset 翻页漂移）。
func tweetCommentPageOrder(filter domaintweet.ListFilter) string {
	if filter.ParentID != nil && filter.Sort != "desc" {
		// 回复链默认最早优先（对话时间线）
		return "created_at ASC, id ASC"
	}
	return "created_at DESC, id DESC"
}

// CountByTweet 统计推文下的评论总数（顶层 + 回复）。
func (r *TweetCommentRepository) CountByTweet(ctx context.Context, tweetID domainshared.ID) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&model.TweetComment{}).
		Where("tweet_id = ?", tweetID.UUID()).Count(&n).Error
	if err != nil {
		return 0, domainshared.Internal("统计推文评论数失败", err)
	}
	return n, nil
}

// CountByTweetIDs 批量统计多推文的评论数（GROUP BY tweet_id）。
func (r *TweetCommentRepository) CountByTweetIDs(ctx context.Context, tweetIDs []domainshared.ID) (map[string]int64, error) {
	result := make(map[string]int64, len(tweetIDs))
	if len(tweetIDs) == 0 {
		return result, nil
	}
	uuids := make([]interface{}, 0, len(tweetIDs))
	for _, id := range tweetIDs {
		uuids = append(uuids, id.UUID())
	}
	var rows []struct {
		TweetID string `gorm:"column:tweet_id"`
		Count   int64  `gorm:"column:cnt"`
	}
	err := r.db.WithContext(ctx).Model(&model.TweetComment{}).
		Select("tweet_id, COUNT(*) AS cnt").
		Where("tweet_id IN ?", uuids).
		Group("tweet_id").Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量统计推文评论数失败", err)
	}
	for _, row := range rows {
		result[row.TweetID] = row.Count
	}
	return result, nil
}

// CountRepliesByParents 批量统计多条顶层评论各自的回复数。
//
// 回复的 path 以顶层评论 id 为前缀（形如 "<topID>/..."，两层扁平下「回复 @yyy」
// 的回复也挂同一顶层），故按 SUBSTR(path, 1, 37) 取顶层前缀 GROUP BY 聚合，
// 一次查询拿到全部计数，避免每评论一条 COUNT 的 N+1。
// 用 SUBSTR 而非 LEFT：兼容 SQLite（测试库）与 PostgreSQL。
func (r *TweetCommentRepository) CountRepliesByParents(ctx context.Context, parentIDs []domainshared.ID) (map[string]int64, error) {
	result := make(map[string]int64, len(parentIDs))
	if len(parentIDs) == 0 {
		return result, nil
	}
	prefixes := make([]interface{}, 0, len(parentIDs))
	for _, id := range parentIDs {
		prefixes = append(prefixes, id.String()+"/")
	}
	var rows []struct {
		TopPath string `gorm:"column:top_path"`
		Count   int64  `gorm:"column:cnt"`
	}
	err := r.db.WithContext(ctx).Model(&model.TweetComment{}).
		Select("SUBSTR(path, 1, 37) AS top_path, COUNT(*) AS cnt").
		Where("depth = ?", 1).
		Where("SUBSTR(path, 1, 37) IN ?", prefixes).
		Group("top_path").Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量统计推文回复数失败", err)
	}
	for _, row := range rows {
		result[strings.TrimSuffix(row.TopPath, "/")] = row.Count
	}
	return result, nil
}

// Delete 物理删除评论。顶层评论删除时其回复由 parent_id 自引用 ON DELETE CASCADE 连带清理。
func (r *TweetCommentRepository) Delete(ctx context.Context, id domainshared.ID) error {
	res := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.TweetComment{})
	if res.Error != nil {
		return domainshared.Internal("删除推文评论失败", res.Error)
	}
	if res.RowsAffected == 0 {
		return domaintweet.ErrCommentNotFound
	}
	return nil
}

// commentToPO 领域实体 → 持久化模型。
func tweetCommentToPO(c *domaintweet.Comment) model.TweetComment {
	var picturesJSON []byte
	if len(c.Pictures()) > 0 {
		picturesJSON, _ = json.Marshal(c.Pictures())
	} else {
		picturesJSON = []byte("[]")
	}
	po := model.TweetComment{
		ID:       c.ID().UUID(),
		TweetID:  c.TweetID().UUID(),
		AuthorID: c.AuthorID().UUID(),
		Body:     c.Body(),
		Pictures: picturesJSON,
		ParentID: nil,
		Path:     c.Path(),
		Depth:    c.Depth(),
	}
	if p := c.ParentID(); p != nil {
		pid := p.UUID()
		po.ParentID = &pid
	}
	if c2 := c.CreatedAt(); !c2.IsZero() {
		po.CreatedAt = c2
	}
	if u := c.UpdatedAt(); !u.IsZero() {
		po.UpdatedAt = u
	}
	return po
}

// commentToDomain 持久化模型 → 领域实体。
func tweetCommentToDomain(po model.TweetComment) *domaintweet.Comment {
	var parentID *domainshared.ID
	if po.ParentID != nil {
		pid := domainshared.MustParseID(po.ParentID.String())
		parentID = &pid
	}
	var pictures []domaintweet.Picture
	if len(po.Pictures) > 0 {
		_ = json.Unmarshal(po.Pictures, &pictures)
	}
	return domaintweet.ReconstructComment(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.TweetID.String()),
		domainshared.MustParseID(po.AuthorID.String()),
		po.Body,
		pictures,
		parentID,
		po.Depth,
		po.Path,
		po.CreatedAt,
		po.UpdatedAt,
	)
}

// tweetCommentPOsToDomain 批量转换持久化模型 → 领域实体。
func tweetCommentPOsToDomain(pos []model.TweetComment) []*domaintweet.Comment {
	result := make([]*domaintweet.Comment, 0, len(pos))
	for _, po := range pos {
		result = append(result, tweetCommentToDomain(po))
	}
	return result
}

// 编译期断言：仓储实现满足领域接口。
var _ domaintweet.CommentRepository = (*TweetCommentRepository)(nil)
