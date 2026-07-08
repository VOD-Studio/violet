// Package gorm 提供 commentreaction 模块的 GORM 存储实现。
package gorm

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domaincr "blog-api/internal/domain/commentreaction"
	domainshared "blog-api/internal/domain/shared"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// CommentReactionStore 实现领域 CommentReactionStore 端口
type CommentReactionStore struct{ db *gorm.DB }

// NewCommentReactionStore 创建评论反应存储
func NewCommentReactionStore(db *gorm.DB) *CommentReactionStore {
	return &CommentReactionStore{db: db}
}

// parseUUID 安全解析 UUID
func parseUUID(s string) uuid.UUID {
	id, _ := uuid.Parse(s)
	return id
}

// ListByComment 查询评论反应（按 emoji 分组计数，并标识当前用户是否已反应）
func (s *CommentReactionStore) ListByComment(ctx context.Context, commentID, viewerUserID string) ([]domaincr.AggregatedReaction, error) {
	var rows []struct {
		EmojiID   int32  `gorm:"column:emoji_id"`
		EmojiName string `gorm:"column:emoji_name"`
		EmojiURL  string `gorm:"column:emoji_url"`
		Count     int64  `gorm:"column:count"`
		SelfInt   int    `gorm:"column:self_int"`
	}
	err := s.db.WithContext(ctx).
		Table("comment_reactions cr").
		Select("cr.emoji_id, e.name AS emoji_name, e.url AS emoji_url, COUNT(*) AS count, MAX(CASE WHEN cr.user_id = ? THEN 1 ELSE 0 END) AS self_int", parseUUID(viewerUserID)).
		Joins("LEFT JOIN emojis e ON e.id = cr.emoji_id").
		Where("cr.comment_id = ?", parseUUID(commentID)).
		Group("cr.emoji_id, e.name, e.url").
		Order("count DESC, cr.emoji_id ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("查询评论反应失败", err)
	}
	result := make([]domaincr.AggregatedReaction, 0, len(rows))
	for _, r := range rows {
		result = append(result, domaincr.AggregatedReaction{
			EmojiID: r.EmojiID, EmojiName: r.EmojiName, EmojiURL: r.EmojiURL,
			Count: r.Count, Self: r.SelfInt > 0,
		})
	}
	return result, nil
}

// Add 添加反应（幂等）
// 登录用户按 (comment_id, emoji_id, user_id) 去重；匿名按 (comment_id, emoji_id, ip_hash, user_id IS NULL) 去重。
func (s *CommentReactionStore) Add(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error {
	po := newmodel.CommentReaction{
		ID: uuid.New(), CommentID: parseUUID(commentID), EmojiID: emojiID,
	}
	if userID != "" {
		uid := parseUUID(userID)
		po.UserID = &uid
		po.IPHash = "" // 登录态以 user_id 为唯一维度，无需记录 IP
	} else {
		po.IPHash = ipHash
	}
	// 幂等：唯一键冲突时静默忽略，避免并发/重复提交报错
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&po).Error
}

// Remove 移除反应
func (s *CommentReactionStore) Remove(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error {
	cid := parseUUID(commentID)
	query := s.db.WithContext(ctx).Where("comment_id = ? AND emoji_id = ?", cid, emojiID)
	if userID != "" {
		query = query.Where("user_id = ?", parseUUID(userID))
	} else {
		query = query.Where("user_id IS NULL AND ip_hash = ?", ipHash)
	}
	return query.Delete(&newmodel.CommentReaction{}).Error
}

// BatchByComments 批量查询多评论反应（按 emoji 分组计数，并标识当前用户是否已反应）
func (s *CommentReactionStore) BatchByComments(ctx context.Context, commentIDs []string, viewerUserID string) ([]domaincr.ReactionList, error) {
	if len(commentIDs) == 0 {
		return []domaincr.ReactionList{}, nil
	}
	ids := make([]uuid.UUID, 0, len(commentIDs))
	for _, cid := range commentIDs {
		ids = append(ids, parseUUID(cid))
	}
	var rows []struct {
		CommentID uuid.UUID `gorm:"column:comment_id"`
		EmojiID   int32     `gorm:"column:emoji_id"`
		EmojiName string    `gorm:"column:emoji_name"`
		EmojiURL  string    `gorm:"column:emoji_url"`
		Count     int64     `gorm:"column:count"`
		SelfInt   int       `gorm:"column:self_int"`
	}
	err := s.db.WithContext(ctx).
		Table("comment_reactions cr").
		Select("cr.comment_id, cr.emoji_id, e.name AS emoji_name, e.url AS emoji_url, COUNT(*) AS count, MAX(CASE WHEN cr.user_id = ? THEN 1 ELSE 0 END) AS self_int", parseUUID(viewerUserID)).
		Joins("LEFT JOIN emojis e ON e.id = cr.emoji_id").
		Where("cr.comment_id IN ?", ids).
		Group("cr.comment_id, cr.emoji_id, e.name, e.url").
		Order("cr.comment_id, count DESC, cr.emoji_id ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量查询评论反应失败", err)
	}
	grouped := make(map[string][]domaincr.AggregatedReaction)
	for _, r := range rows {
		cid := r.CommentID.String()
		grouped[cid] = append(grouped[cid], domaincr.AggregatedReaction{
			EmojiID: r.EmojiID, EmojiName: r.EmojiName, EmojiURL: r.EmojiURL,
			Count: r.Count, Self: r.SelfInt > 0,
		})
	}
	result := make([]domaincr.ReactionList, 0, len(commentIDs))
	for _, cid := range commentIDs {
		result = append(result, domaincr.ReactionList{CommentID: cid, Reactions: grouped[cid]})
	}
	return result, nil
}

var _ domaincr.CommentReactionStore = (*CommentReactionStore)(nil)
