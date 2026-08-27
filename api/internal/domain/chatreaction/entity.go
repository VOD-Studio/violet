// Package chatreaction 提供聊天消息反应的聚合读模型与存储端口。
package chatreaction

import "blog-api/internal/domain/shared"

const (
	// MaxReactionsPerMessagePerUser 单个用户对同一消息可添加的不同表情上限。
	MaxReactionsPerMessagePerUser = 3
)

// AggregatedReaction 按表情聚合后的聊天消息反应读模型。
type AggregatedReaction struct {
	// EmojiID 表情 ID。
	EmojiID int32 `json:"emoji_id"`
	// EmojiName 表情名称。
	EmojiName string `json:"emoji_name"`
	// EmojiURL 表情静态图 URL。
	EmojiURL string `json:"emoji_url"`
	// GifURL 表情动图 URL；无动图时为空。
	GifURL string `json:"gif_url"`
	// Count 该表情的反应数量。
	Count int64 `json:"count"`
	// Self 当前用户是否已添加该表情。
	Self bool `json:"self"`
}

// ErrReactionLimitReached 当前用户在同一消息上的表情种类已达上限。
var ErrReactionLimitReached = shared.Conflict("单条消息最多添加 3 种表情")
