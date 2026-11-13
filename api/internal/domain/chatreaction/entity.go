// Package chatreaction 提供聊天消息反应的聚合读模型与存储端口。
package chatreaction

import "blog-api/internal/domain/shared"

const (
	// MaxReactionsPerMessagePerUser 单个用户对同一消息可添加的不同表情上限。
	MaxReactionsPerMessagePerUser = 3
	// MaxReactionKindsPerMessage 所有用户对同一消息可添加的不同表情总上限。
	MaxReactionKindsPerMessage = 11
)

// RecentUser 是聚合反应中可展示的最近回应者。
type RecentUser struct {
	// ID 回应者用户 ID。
	ID string `json:"id"`
	// Name 展示名，未设置时使用用户名。
	Name string `json:"name"`
}

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
	// RecentUsers 最近的至多三位回应者，按回应时间及反应 ID 倒序；空值为 []。
	RecentUsers []RecentUser `json:"recent_users"`
}

// ErrMessageReactionLimitReached 添加反应后整条消息的表情种类将超过上限。
var ErrMessageReactionLimitReached = shared.Conflict("每条消息最多 11 种不同回应")
