package gorm

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"blog-api/internal/domain/commentreaction"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// TweetCommentReactionStore 推文评论回应的独立持久化实现。
type TweetCommentReactionStore struct {
	db *gorm.DB
}

// NewTweetCommentReactionStore 构造存储。
func NewTweetCommentReactionStore(db *gorm.DB) *TweetCommentReactionStore {
	return &TweetCommentReactionStore{db: db}
}

// BatchByComments 一次筛选推文内目标集合，复用文章的聚合顺序、公开最近名单和空数组规则。
func (s *TweetCommentReactionStore) BatchByComments(ctx context.Context, tweetID shared.ID, commentIDs []string, viewerUserID string) ([]commentreaction.ReactionList, error) {
	if len(commentIDs) == 0 {
		return []commentreaction.ReactionList{}, nil
	}
	ids := make([]uuid.UUID, 0, len(commentIDs))
	for _, commentID := range commentIDs {
		ids = append(ids, parseUUID(commentID))
	}
	var targets []uuid.UUID
	if err := s.db.WithContext(ctx).Model(&model.TweetComment{}).
		Where("tweet_id = ? AND id IN ?", tweetID.UUID(), ids).
		Pluck("id", &targets).Error; err != nil {
		return nil, shared.Internal("批量查询推文评论失败", err)
	}
	targetIDs := make([]string, 0, len(targets))
	for _, target := range targets {
		targetIDs = append(targetIDs, target.String())
	}
	lists, err := batchCommentReactions(ctx, s.db, "tweet_comment_reactions", targetIDs, viewerUserID)
	if err != nil {
		return nil, err
	}
	grouped := make(map[uuid.UUID][]commentreaction.AggregatedReaction, len(lists))
	for _, list := range lists {
		grouped[parseUUID(list.CommentID)] = list.Reactions
	}
	result := make([]commentreaction.ReactionList, 0, len(commentIDs))
	for i, commentID := range commentIDs {
		reactions := grouped[ids[i]]
		if reactions == nil {
			reactions = []commentreaction.AggregatedReaction{}
		}
		result = append(result, commentreaction.ReactionList{CommentID: commentID, Reactions: reactions})
	}
	return result, nil
}

// Add 唯一键冲突时保持幂等，外键保证评论、用户及表情真实存在。
func (s *TweetCommentReactionStore) Add(ctx context.Context, commentID, userID shared.ID, emojiID int32) error {
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&model.TweetCommentReaction{
		ID: uuid.New(), CommentID: commentID.UUID(), UserID: userID.UUID(), EmojiID: emojiID,
	}).Error; err != nil {
		return shared.Internal("添加推文评论回应失败", err)
	}
	return nil
}

// Remove 仅删除登录用户自己的回应，重复取消幂等。
func (s *TweetCommentReactionStore) Remove(ctx context.Context, commentID, userID shared.ID, emojiID int32) error {
	if err := s.db.WithContext(ctx).
		Where("comment_id = ? AND user_id = ? AND emoji_id = ?", commentID.UUID(), userID.UUID(), emojiID).
		Delete(&model.TweetCommentReaction{}).Error; err != nil {
		return shared.Internal("取消推文评论回应失败", err)
	}
	return nil
}

var _ tweet.CommentReactionStore = (*TweetCommentReactionStore)(nil)
