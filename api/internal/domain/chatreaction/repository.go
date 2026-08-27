package chatreaction

import (
	"context"

	"blog-api/internal/domain/shared"
)

// Store 聊天消息反应持久化端口。
type Store interface {
	// ListByMessages 批量查询消息反应，并标记当前用户已添加的表情。
	ListByMessages(ctx context.Context, messageIDs []shared.ID, viewerUserID shared.ID) (map[string][]AggregatedReaction, error)
	// Add 添加消息反应；同一用户重复添加同一表情时保持幂等。
	Add(ctx context.Context, messageID, userID shared.ID, emojiID int32) error
	// Remove 移除当前用户对消息的指定表情反应。
	Remove(ctx context.Context, messageID, userID shared.ID, emojiID int32) error
	// RemoveByMessage 清理已删除消息的全部反应。
	RemoveByMessage(ctx context.Context, messageID shared.ID) error
}
