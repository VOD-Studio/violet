// Package gorm 提供 commentreaction 模块的 GORM 存储实现。
package gorm

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

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

// ListByComment 查询评论反应（join emojis 取 name/url）
func (s *CommentReactionStore) ListByComment(ctx context.Context, commentID string) ([]domaincr.Reaction, error) {
	var rows []struct {
		ID        uuid.UUID `gorm:"column:id"`
		CommentID uuid.UUID `gorm:"column:comment_id"`
		UserID    *uuid.UUID `gorm:"column:user_id"`
		EmojiID   int32     `gorm:"column:emoji_id"`
		EmojiName string    `gorm:"column:emoji_name"`
		EmojiURL  string    `gorm:"column:emoji_url"`
		IPHash    string    `gorm:"column:ip_hash"`
		CreatedAt time.Time `gorm:"column:created_at"`
	}
	err := s.db.WithContext(ctx).
		Table("comment_reactions cr").
		Select("cr.id, cr.comment_id, cr.user_id, cr.emoji_id, cr.ip_hash, cr.created_at, e.name AS emoji_name, e.url AS emoji_url").
		Joins("LEFT JOIN emojis e ON e.id = cr.emoji_id").
		Where("cr.comment_id = ?", parseUUID(commentID)).
		Order("cr.created_at DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("查询评论反应失败", err)
	}
	result := make([]domaincr.Reaction, 0, len(rows))
	for _, r := range rows {
		dto := domaincr.Reaction{
			ID: 0, CommentID: r.CommentID.String(), EmojiID: r.EmojiID,
			EmojiName: r.EmojiName, EmojiURL: r.EmojiURL,
			IPAddress: r.IPHash, CreatedAt: r.CreatedAt.Format(time.RFC3339),
		}
		if r.UserID != nil {
			dto.UserID = r.UserID.String()
		}
		result = append(result, dto)
	}
	return result, nil
}

// Add 添加反应（幂等）
func (s *CommentReactionStore) Add(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error {
	po := newmodel.CommentReaction{
		ID: uuid.New(), CommentID: parseUUID(commentID), EmojiID: emojiID, IPHash: ipHash,
	}
	if userID != "" {
		uid := parseUUID(userID)
		po.UserID = &uid
	}
	// 幂等：重复添加忽略
	return s.db.WithContext(ctx).
		Where("comment_id = ? AND emoji_id = ? AND ip_hash = ?", po.CommentID, emojiID, ipHash).
		FirstOrCreate(&po).Error
}

// Remove 移除反应
func (s *CommentReactionStore) Remove(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error {
	cid := parseUUID(commentID)
	query := s.db.WithContext(ctx).Where("comment_id = ? AND emoji_id = ? AND ip_hash = ?", cid, emojiID, ipHash)
	if userID != "" {
		query = query.Where("user_id = ?", parseUUID(userID))
	} else {
		query = query.Where("user_id IS NULL")
	}
	return query.Delete(&newmodel.CommentReaction{}).Error
}

// BatchByComments 批量查询多评论反应
func (s *CommentReactionStore) BatchByComments(ctx context.Context, commentIDs []string) ([]domaincr.BatchResult, error) {
	if len(commentIDs) == 0 {
		return []domaincr.BatchResult{}, nil
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
	}
	err := s.db.WithContext(ctx).
		Table("comment_reactions cr").
		Select("cr.comment_id, cr.emoji_id, e.name AS emoji_name, e.url AS emoji_url").
		Joins("LEFT JOIN emojis e ON e.id = cr.emoji_id").
		Where("cr.comment_id IN ?", ids).
		Scan(&rows).Error
	if err != nil {
		return nil, domainshared.Internal("批量查询评论反应失败", err)
	}
	grouped := make(map[string][]domaincr.Reaction)
	for _, r := range rows {
		cid := r.CommentID.String()
		grouped[cid] = append(grouped[cid], domaincr.Reaction{
			CommentID: cid, EmojiID: r.EmojiID,
			EmojiName: r.EmojiName, EmojiURL: r.EmojiURL,
		})
	}
	result := make([]domaincr.BatchResult, 0, len(commentIDs))
	for _, cid := range commentIDs {
		result = append(result, domaincr.BatchResult{CommentID: cid, Reactions: grouped[cid]})
	}
	return result, nil
}

var _ domaincr.CommentReactionStore = (*CommentReactionStore)(nil)
