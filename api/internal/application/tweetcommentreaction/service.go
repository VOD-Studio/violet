// Package tweetcommentreaction 提供推文评论的统一表情回应用例。
package tweetcommentreaction

import (
	"context"

	"blog-api/internal/domain/commentreaction"
	"blog-api/internal/domain/emoji"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/tweet"
)

// MaxBatchCommentIDs 限制每次批量读取的唯一评论数，重复 UUID 不占用额外名额。
const MaxBatchCommentIDs = 100

// TweetLookup 复用公开推文详情的存在性及可见性查询。
type TweetLookup interface {
	FindByID(context.Context, shared.ID) (*tweet.Tweet, error)
}

// CommentLookup 查询评论并校验其所属推文。
type CommentLookup interface {
	FindByID(context.Context, shared.ID) (*tweet.Comment, error)
}

// EmojiLookup 仅查询系统目录，不接收私人自定义表情。
type EmojiLookup interface {
	FindEmojiByID(context.Context, int32) (emoji.Emoji, error)
	FindByID(context.Context, int32) (*emoji.EmojiGroup, error)
}

// Service 推文评论回应服务，所有依赖均由生产容器提供。
type Service struct {
	tweets   TweetLookup
	comments CommentLookup
	emojis   EmojiLookup
	store    tweet.CommentReactionStore
}

// NewService 装配真实查询与回应存储端口。
func NewService(tweets TweetLookup, comments CommentLookup, emojis EmojiLookup, store tweet.CommentReactionStore) *Service {
	return &Service{tweets: tweets, comments: comments, emojis: emojis, store: store}
}

// List 查询可公开访问评论的回应，匿名 self 恒为 false。
func (s *Service) List(ctx context.Context, tweetID, commentID, viewerID string) ([]commentreaction.AggregatedReaction, error) {
	tid, err := s.validateTweet(ctx, tweetID)
	if err != nil {
		return nil, err
	}
	cid, err := s.validateComment(ctx, tid, commentID)
	if err != nil {
		return nil, err
	}
	if viewerID != "" {
		if _, err := shared.ParseID(viewerID); err != nil {
			return nil, err
		}
	}
	lists, err := s.store.BatchByComments(ctx, tid, []string{cid.String()}, viewerID)
	if err != nil {
		return nil, err
	}
	return lists[0].Reactions, nil
}

// Batch 按首次出现顺序读取至多 100 个唯一评论；过期或其它推文的 ID 返回空回应。
func (s *Service) Batch(ctx context.Context, tweetID string, commentIDs []string, viewerID string) ([]commentreaction.ReactionList, error) {
	id, err := s.validateTweet(ctx, tweetID)
	if err != nil {
		return nil, err
	}
	if viewerID != "" {
		if _, err := shared.ParseID(viewerID); err != nil {
			return nil, err
		}
	}
	ids := make([]string, 0, min(len(commentIDs), MaxBatchCommentIDs))
	seen := make(map[shared.ID]struct{}, min(len(commentIDs), MaxBatchCommentIDs))
	for _, commentID := range commentIDs {
		cid, err := shared.ParseID(commentID)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[cid]; exists {
			continue
		}
		if len(ids) == MaxBatchCommentIDs {
			return nil, shared.BadRequest("每次最多查询 100 个唯一评论")
		}
		seen[cid] = struct{}{}
		ids = append(ids, commentID)
	}
	return s.store.BatchByComments(ctx, id, ids, viewerID)
}

// Add 添加公开目录中的普通或颜文字回应，重复添加幂等。
func (s *Service) Add(ctx context.Context, tweetID, commentID, userID string, emojiID int32) error {
	uid, err := authenticatedUser(userID)
	if err != nil {
		return err
	}
	cid, err := s.validateTarget(ctx, tweetID, commentID)
	if err != nil {
		return err
	}
	if emojiID <= 0 {
		return shared.BadRequest("表情 ID 必须为正整数")
	}
	e, err := s.emojis.FindEmojiByID(ctx, emojiID)
	if err != nil {
		return err
	}
	group, err := s.emojis.FindByID(ctx, e.GroupID())
	if err != nil {
		return err
	}
	if !group.IsEnabled() || (e.Meta().Type() != 0 && e.Meta().Type() != emoji.TypeNormal && e.Meta().Type() != emoji.TypeText) {
		return shared.BadRequest("该表情不可用于回应")
	}
	return s.store.Add(ctx, cid, uid, emojiID)
}

// Remove 取消自己的回应；目录禁用后仍可取消已存在回应。
func (s *Service) Remove(ctx context.Context, tweetID, commentID, userID string, emojiID int32) error {
	uid, err := authenticatedUser(userID)
	if err != nil {
		return err
	}
	cid, err := s.validateTarget(ctx, tweetID, commentID)
	if err != nil {
		return err
	}
	if emojiID <= 0 {
		return shared.BadRequest("表情 ID 必须为正整数")
	}
	return s.store.Remove(ctx, cid, uid, emojiID)
}

func authenticatedUser(userID string) (shared.ID, error) {
	if userID == "" {
		return shared.ID{}, shared.Unauthorized("请先登录")
	}
	return shared.ParseID(userID)
}

func (s *Service) validateTweet(ctx context.Context, tweetID string) (shared.ID, error) {
	id, err := shared.ParseID(tweetID)
	if err != nil {
		return shared.ID{}, err
	}
	if _, err := s.tweets.FindByID(ctx, id); err != nil {
		return shared.ID{}, err
	}
	return id, nil
}

func (s *Service) validateTarget(ctx context.Context, tweetID, commentID string) (shared.ID, error) {
	id, err := s.validateTweet(ctx, tweetID)
	if err != nil {
		return shared.ID{}, err
	}
	return s.validateComment(ctx, id, commentID)
}

func (s *Service) validateComment(ctx context.Context, tweetID shared.ID, commentID string) (shared.ID, error) {
	id, err := shared.ParseID(commentID)
	if err != nil {
		return shared.ID{}, err
	}
	comment, err := s.comments.FindByID(ctx, id)
	if err != nil {
		return shared.ID{}, err
	}
	if comment.TweetID() != tweetID {
		return shared.ID{}, tweet.ErrCommentNotFound
	}
	return id, nil
}
