// Package commentreaction 提供评论反应的读模型与存储端口。
//
// 本包为查询侧（read-model）：Reaction 是面向展示的 DTO，非聚合根。
// 反应的写模型去重/计数逻辑由存储实现层处理。
package commentreaction

import (
	"context"

	"blog-api/internal/domain/shared"
)

// AggregatedReaction 聚合后的评论反应读模型（面向展示）
type AggregatedReaction struct {
	// EmojiID 表情 id
	EmojiID int32 `json:"emoji_id"`
	// EmojiName 表情名称（展示用）
	EmojiName string `json:"emoji_name"`
	// EmojiURL 表情静态图 URL
	EmojiURL string `json:"emoji_url"`
	// GifURL 表情动图 URL（hover/放大时用，无则为空）
	GifURL string `json:"gif_url"`
	// Count 该表情的反应计数（按 emoji 分组聚合）
	Count int64 `json:"count"`
	// Self 当前 viewer 是否已对该表情反应（高亮「我点过的」）
	Self bool `json:"self"`
}

// ReactionList 单条评论的聚合反应列表
type ReactionList struct {
	// CommentID 所属评论 id
	CommentID string `json:"comment_id"`
	// Reactions 该评论下的聚合反应列表（按 emoji 分组）
	Reactions []AggregatedReaction `json:"reactions"`
}

// CommentReactionStore 评论反应存储端口
type CommentReactionStore interface {
	// ListByComment 查询评论的反应列表（按 emoji 分组计数，携带当前用户是否已反应）
	ListByComment(ctx context.Context, commentID, viewerUserID string) ([]AggregatedReaction, error)
	// Add 添加反应（幂等：已存在则忽略）
	Add(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error
	// Remove 移除反应
	Remove(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error
	// BatchByComments 批量查询多评论的反应（按 emoji 分组计数）
	BatchByComments(ctx context.Context, commentIDs []string, viewerUserID string) ([]ReactionList, error)
}

var ErrEmojiNotFound = shared.NotFound("表情")
