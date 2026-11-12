package tweet

import (
	"context"

	"blog-api/internal/domain/commentreaction"
	"blog-api/internal/domain/shared"
)

// CommentReactionStore 推文评论回应端口，与文章评论分表持久化，共享公开读模型。
type CommentReactionStore interface {
	// BatchByComments 仅聚合指定推文下的评论，按输入顺序返回；不存在或归属不符的评论回应为 []。
	BatchByComments(ctx context.Context, tweetID shared.ID, commentIDs []string, viewerUserID string) ([]commentreaction.ReactionList, error)
	// Add 幂等添加当前登录用户的回应。
	Add(ctx context.Context, commentID, userID shared.ID, emojiID int32) error
	// Remove 幂等移除当前登录用户的回应。
	Remove(ctx context.Context, commentID, userID shared.ID, emojiID int32) error
}
