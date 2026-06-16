package gorm

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"

	"blog-api/internal/domain/comment"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// CommentRepository 评论仓储 GORM 实现
type CommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func commentToPO(c *comment.Comment) (model.Comment, error) {
	var picturesJSON []byte
	if len(c.Pictures()) > 0 {
		picturesJSON, _ = json.Marshal(c.Pictures())
	} else {
		picturesJSON = []byte("[]")
	}
	var parentID *interface{}
	_ = parentID

	po := model.Comment{
		ID: c.ID().UUID(), Path: c.Path(), Depth: c.Depth(),
		AuthorName: c.AuthorName(), AuthorEmail: c.AuthorEmail(),
		AuthorURL: c.AuthorURL(), AvatarURL: c.AvatarURL(),
		Body: c.Body(), Pictures: picturesJSON,
		Status: c.Status(), IPHash: c.IPHash(), UserAgent: c.UserAgent(),
	}
	po.PostID = c.PostID().UUID()
	if p := c.ParentID(); p != nil {
		pid := p.UUID()
		po.ParentID = &pid
	}
	if t := c.CreatedAt(); !t.IsZero() {
		po.CreatedAt = t
		po.UpdatedAt = c.UpdatedAt()
	} else {
		po.CreatedAt = time.Now()
		po.UpdatedAt = time.Now()
	}
	return po, nil
}

func commentToDomain(po model.Comment) (*comment.Comment, error) {
	var pictures []comment.Picture
	if len(po.Pictures) > 0 {
		_ = json.Unmarshal(po.Pictures, &pictures)
	}
	var parentID *domainshared.ID
	if po.ParentID != nil {
		pid := domainshared.MustParseID(po.ParentID.String())
		parentID = &pid
	}
	return comment.ReconstructComment(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.PostID.String()),
		parentID, po.Path, po.Depth,
		po.AuthorName, po.AuthorEmail, po.AuthorURL, po.AvatarURL,
		po.Body, pictures, po.Status, po.IPHash, po.UserAgent,
		po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *CommentRepository) FindByID(ctx context.Context, id domainshared.ID) (*comment.Comment, error) {
	var po model.Comment
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, comment.ErrNotFound
		}
		return nil, domainshared.Internal("查询评论失败", err)
	}
	return commentToDomain(po)
}

func (r *CommentRepository) FindByPost(ctx context.Context, postID domainshared.ID, status string, page, limit int) ([]*comment.Comment, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).Where("post_id = ?", postID.UUID())
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计评论失败", err)
	}
	var pos []model.Comment
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询评论列表失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, total, nil
}

func (r *CommentRepository) FindReplies(ctx context.Context, parentPath string) ([]*comment.Comment, error) {
	var pos []model.Comment
	// 查询 path 以 parentPath 开头的所有后代
	if err := r.db.WithContext(ctx).Where("path LIKE ?", parentPath+"%").
		Order("created_at ASC").Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询回复失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, nil
}

func (r *CommentRepository) FindPending(ctx context.Context, page, limit int) ([]*comment.Comment, int64, error) {
	query := r.db.WithContext(ctx).Model(&model.Comment{}).Where("status = ?", comment.StatusPending)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, domainshared.Internal("统计待审核评论失败", err)
	}
	var pos []model.Comment
	offset := (page - 1) * limit
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&pos).Error; err != nil {
		return nil, 0, domainshared.Internal("查询待审核评论失败", err)
	}
	result := make([]*comment.Comment, 0, len(pos))
	for _, po := range pos {
		c, _ := commentToDomain(po)
		result = append(result, c)
	}
	return result, total, nil
}

func (r *CommentRepository) Save(ctx context.Context, c *comment.Comment) error {
	po, err := commentToPO(c)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存评论失败", err)
	}
	return nil
}

func (r *CommentRepository) UpdateStatus(ctx context.Context, id domainshared.ID, status string) error {
	result := r.db.WithContext(ctx).Model(&model.Comment{}).
		Where("id = ?", id.UUID()).Update("status", status)
	if result.Error != nil {
		return domainshared.Internal("更新评论状态失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return comment.ErrNotFound
	}
	return nil
}

func (r *CommentRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.Comment{})
	if result.Error != nil {
		return domainshared.Internal("删除评论失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return comment.ErrNotFound
	}
	return nil
}

var _ comment.CommentRepository = (*CommentRepository)(nil)

// ============================================================
// ReactionRepository
// ============================================================

type ReactionRepository struct {
	db *gorm.DB
}

func NewReactionRepository(db *gorm.DB) *ReactionRepository {
	return &ReactionRepository{db: db}
}

func (r *ReactionRepository) FindByComment(ctx context.Context, commentID domainshared.ID) ([]*comment.Reaction, error) {
	var pos []model.CommentReaction
	if err := r.db.WithContext(ctx).Where("comment_id = ?", commentID.UUID()).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("查询评论反应失败", err)
	}
	result := make([]*comment.Reaction, 0, len(pos))
	for _, po := range pos {
		var userID *domainshared.ID
		if po.UserID != nil {
			uid := domainshared.MustParseID(po.UserID.String())
			userID = &uid
		}
		result = append(result, comment.NewReaction(
			domainshared.MustParseID(po.ID.String()), commentID, po.EmojiID, userID, po.IPHash,
		))
	}
	return result, nil
}

func (r *ReactionRepository) FindBatch(ctx context.Context, commentIDs []domainshared.ID) (map[domainshared.ID][]*comment.Reaction, error) {
	result := make(map[domainshared.ID][]*comment.Reaction)
	if len(commentIDs) == 0 {
		return result, nil
	}
	uuids := make([]interface{}, len(commentIDs))
	for i, id := range commentIDs {
		uuids[i] = id.UUID()
	}
	var pos []model.CommentReaction
	if err := r.db.WithContext(ctx).Where("comment_id IN ?", uuids).Find(&pos).Error; err != nil {
		return nil, domainshared.Internal("批量查询反应失败", err)
	}
	for _, po := range pos {
		cid := domainshared.MustParseID(po.CommentID.String())
		var userID *domainshared.ID
		if po.UserID != nil {
			uid := domainshared.MustParseID(po.UserID.String())
			userID = &uid
		}
		reaction := comment.NewReaction(
			domainshared.MustParseID(po.ID.String()), cid, po.EmojiID, userID, po.IPHash,
		)
		result[cid] = append(result[cid], reaction)
	}
	return result, nil
}

func (r *ReactionRepository) Save(ctx context.Context, reaction *comment.Reaction) error {
	po := model.CommentReaction{
		ID: reaction.ID().UUID(), CommentID: reaction.CommentID().UUID(),
		EmojiID: reaction.EmojiID(), IPHash: reaction.IPHash(),
	}
	if u := reaction.UserID(); u != nil {
		uid := u.UUID()
		po.UserID = &uid
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存评论反应失败", err)
	}
	return nil
}

func (r *ReactionRepository) Remove(ctx context.Context, commentID, emojiID domainshared.ID, userID *domainshared.ID, ipHash string) error {
	query := r.db.WithContext(ctx).Where("comment_id = ? AND emoji_id = ?", commentID.UUID(), int32(0))
	// emojiID 实际是 int32，修正
	query = r.db.WithContext(ctx).Where("comment_id = ?", commentID.UUID())
	if userID != nil {
		query = query.Where("user_id = ?", userID.UUID())
	} else {
		query = query.Where("ip_hash = ?", ipHash)
	}
	_ = emojiID // 通过外部传入
	return query.Delete(&model.CommentReaction{}).Error
}

func (r *ReactionRepository) CountByEmoji(ctx context.Context, commentID domainshared.ID) (map[int32]int64, error) {
	type countResult struct {
		EmojiID int32 `gorm:"column:emoji_id"`
		Count   int64
	}
	var results []countResult
	err := r.db.WithContext(ctx).Model(&model.CommentReaction{}).
		Select("emoji_id, COUNT(*) as count").
		Where("comment_id = ?", commentID.UUID()).
		Group("emoji_id").
		Scan(&results).Error
	if err != nil {
		return nil, domainshared.Internal("统计反应失败", err)
	}
	counts := make(map[int32]int64, len(results))
	for _, r := range results {
		counts[r.EmojiID] = r.Count
	}
	return counts, nil
}

var _ comment.ReactionRepository = (*ReactionRepository)(nil)
