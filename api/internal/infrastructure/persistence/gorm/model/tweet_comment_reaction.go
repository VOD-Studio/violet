package model

import (
	"time"

	"github.com/google/uuid"
)

// TweetCommentReaction 推文评论回应，独立外键指向 tweet_comments 而非文章 comments。
type TweetCommentReaction struct {
	// ID 回应记录唯一标识。
	ID uuid.UUID `gorm:"type:uuid;primaryKey"`
	// CommentID 所属推文评论。
	CommentID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:uq_tweet_comment_reaction;index:idx_tweet_comment_reactions_recent,priority:1"`
	// EmojiID 公开表情目录中的表情。
	EmojiID int32 `gorm:"not null;uniqueIndex:uq_tweet_comment_reaction;index:idx_tweet_comment_reactions_recent,priority:2"`
	// UserID 登录回应者，同一评论与表情只可回应一次。
	UserID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:uq_tweet_comment_reaction;index:idx_tweet_comment_reactions_user"`
	// CreatedAt 回应时间，最近参与者按此时间与 ID 倒序。
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_tweet_comment_reactions_recent,priority:3,sort:desc"`
}

// TableName 明确使用独立的推文评论回应表。
func (TweetCommentReaction) TableName() string { return "tweet_comment_reactions" }
