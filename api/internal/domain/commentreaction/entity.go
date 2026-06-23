// Package commentreaction 提供评论反应的读模型与存储端口。
//
// 本包为查询侧（read-model）：Reaction 是面向展示的 DTO，非聚合根。
// 反应的写模型去重/计数逻辑由存储实现层处理。
package commentreaction

import (
	"context"

	"blog-api/internal/domain/shared"
)

// Reaction 评论反应读模型（面向展示的 DTO）
type Reaction struct {
	ID        int64  `json:"id"`
	CommentID string `json:"comment_id"`
	UserID    string `json:"user_id,omitempty"`
	EmojiID   int32  `json:"emoji_id"`
	EmojiName string `json:"emoji_name"`
	EmojiURL  string `json:"emoji_url"`
	IPAddress string `json:"ip_address,omitempty"`
	CreatedAt string `json:"created_at"`
}

// BatchResult 批量反应结果
type BatchResult struct {
	CommentID string     `json:"comment_id"`
	Reactions []Reaction `json:"reactions"`
}

// CommentReactionStore 评论反应存储端口
type CommentReactionStore interface {
	// ListByComment 查询评论的反应列表（按 emoji 分组计数）
	ListByComment(ctx context.Context, commentID string) ([]Reaction, error)
	// Add 添加反应（幂等：已存在则忽略）
	Add(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error
	// Remove 移除反应
	Remove(ctx context.Context, commentID, userID, ipHash string, emojiID int32) error
	// BatchByComments 批量查询多评论的反应
	BatchByComments(ctx context.Context, commentIDs []string) ([]BatchResult, error)
}

var ErrEmojiNotFound = shared.NotFound("表情")
