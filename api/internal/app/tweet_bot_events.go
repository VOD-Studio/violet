package app

import (
	"context"
	"errors"
	"time"

	"github.com/rs/zerolog"

	appchat "blog-api/internal/application/chat"
	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	domainchat "blog-api/internal/domain/chat"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
)

// bot 推文互动事件名。bot 的 SSE 流与聊天共用 /api/v1/chat/bot/events，
// 外部实现按事件名分派。
const (
	botTweetEventCommented = "tweet.commented"
	botTweetEventQuoted    = "tweet.quoted"
	botTweetEventLiked     = "tweet.liked"
)

// tweetEventReader 事件载荷所需的推文/评论读取端口（tweet.Service 实现）。
type tweetEventReader interface {
	GetByID(ctx context.Context, id string) (apptweet.TweetDTO, error)
	GetComment(ctx context.Context, id string) (apptweet.CommentDTO, error)
}

// tweetBotUserReader 互动者资料读取端口。
type tweetBotUserReader interface {
	FindByID(ctx context.Context, id shared.ID) (*domainuser.User, error)
}

// tweetBotEventPusher bot SSE 投递端口。
type tweetBotEventPusher interface {
	Push(botID shared.ID, event appchat.EventDTO)
}

// tweetBotEventSubscriber 把人类对推文的互动转发给内容作者的 bot。
//
// 只处理评论/引用/点赞三类入站事件；作者本人没有 bot 凭证、凭证被禁用、
// 或互动者本身是 bot 时不投递。bot 自己发的内容不会再触发事件给别的 bot，
// 切断 bot 之间的自动对刷。
//
// 流是有损的：SSE 缓冲满即丢，bot 重连后靠公开 GET（推文详情、评论列表）
// 补齐状态，不依赖事件补发。
type tweetBotEventSubscriber struct {
	tweets tweetEventReader
	bots   domainchat.BotRepository
	users  tweetBotUserReader
	pusher tweetBotEventPusher
	log    zerolog.Logger
	now    func() time.Time
}

// NewTweetBotEventSubscriber 构造推文互动事件订阅者。
func NewTweetBotEventSubscriber(
	tweets tweetEventReader,
	bots domainchat.BotRepository,
	users tweetBotUserReader,
	pusher tweetBotEventPusher,
	logger zerolog.Logger,
) *tweetBotEventSubscriber {
	return &tweetBotEventSubscriber{tweets: tweets, bots: bots, users: users, pusher: pusher, log: logger, now: time.Now}
}

// Subscribe 在事件总线上订阅全部事件，内部按类型分发。
func (s *tweetBotEventSubscriber) Subscribe(bus appshared.EventBus) {
	bus.Subscribe("", s.handle)
}

func (s *tweetBotEventSubscriber) handle(ctx context.Context, event shared.DomainEvent) error {
	// 事件在写入请求结束时同步发出；投递不该被请求取消带走。
	ctx = context.WithoutCancel(ctx)
	switch e := event.(type) {
	case domaintweet.TweetCommented:
		s.handleCommented(ctx, e)
	case domaintweet.TweetQuoted:
		s.handleQuoted(ctx, e)
	case domaintweet.TweetLiked:
		s.handleLiked(ctx, e)
	}
	return nil
}

// handleCommented 推文收到评论或回复：推文作者与（若有）被回复评论作者各收一条。
func (s *tweetBotEventSubscriber) handleCommented(ctx context.Context, event domaintweet.TweetCommented) {
	actor := s.actor(ctx, event.ActorID)
	if actor == nil {
		return
	}
	tweet, err := s.tweets.GetByID(ctx, event.AggregateID().String())
	if err != nil {
		s.log.Warn().Err(err).Str("tweet_id", event.AggregateID().String()).Msg("推文评论事件载荷读取失败")
		return
	}
	comment, err := s.tweets.GetComment(ctx, event.CommentID.String())
	if err != nil {
		s.log.Warn().Err(err).Str("comment_id", event.CommentID.String()).Msg("推文评论事件载荷读取失败")
		return
	}
	type recipient struct {
		id     shared.ID
		reason string
	}
	recipients := []recipient{{event.TweetAuthorID, "comment_on_tweet"}}
	if event.RepliedToAuthorID != nil && *event.RepliedToAuthorID != event.TweetAuthorID {
		recipients = append(recipients, recipient{*event.RepliedToAuthorID, "reply_to_comment"})
	}
	for _, recipient := range recipients {
		if recipient.id == event.ActorID {
			continue
		}
		s.push(ctx, recipient.id, appchat.NewBotEventNamed(botTweetEventCommented, map[string]any{
			"reason":  recipient.reason,
			"tweet":   botPayloadTweet(tweet),
			"comment": comment,
		}, s.now()))
	}
}

// handleQuoted 推文被引用：被引用推文的作者收到引用快照。
func (s *tweetBotEventSubscriber) handleQuoted(ctx context.Context, event domaintweet.TweetQuoted) {
	actor := s.actor(ctx, event.ActorID)
	if actor == nil || event.AuthorID == event.ActorID {
		return
	}
	quoted, err := s.tweets.GetByID(ctx, event.AggregateID().String())
	if err != nil {
		s.log.Warn().Err(err).Str("tweet_id", event.AggregateID().String()).Msg("引用推文事件载荷读取失败")
		return
	}
	quote, err := s.tweets.GetByID(ctx, event.QuoteTweetID.String())
	if err != nil {
		s.log.Warn().Err(err).Str("tweet_id", event.QuoteTweetID.String()).Msg("引用推文事件载荷读取失败")
		return
	}
	s.push(ctx, event.AuthorID, appchat.NewBotEventNamed(botTweetEventQuoted, map[string]any{
		"quoted_tweet": botPayloadTweet(quoted),
		"quote":        botPayloadTweet(quote),
	}, s.now()))
}

// handleLiked 推文被点赞：作者收到点赞者资料与推文快照。
func (s *tweetBotEventSubscriber) handleLiked(ctx context.Context, event domaintweet.TweetLiked) {
	actor := s.actor(ctx, event.ActorID)
	if actor == nil || event.AuthorID == event.ActorID {
		return
	}
	tweet, err := s.tweets.GetByID(ctx, event.AggregateID().String())
	if err != nil {
		s.log.Warn().Err(err).Str("tweet_id", event.AggregateID().String()).Msg("推文点赞事件载荷读取失败")
		return
	}
	displayName := actor.DisplayName().String()
	if displayName == "" {
		displayName = actor.Username().String()
	}
	s.push(ctx, event.AuthorID, appchat.NewBotEventNamed(botTweetEventLiked, map[string]any{
		"tweet": botPayloadTweet(tweet),
		"actor": map[string]any{
			"id":           actor.GetID().String(),
			"username":     actor.Username().String(),
			"display_name": displayName,
		},
	}, s.now()))
}

// botPayloadTweet 清掉与视角相关的点赞状态。
//
// 读取发生在人类互动者请求的 ctx 里，TweetDTO.IsLiked 会带上该人类的点赞状态；
// bot 事件是写给 bot 自己看的快照，点赞态一律 false，避免泄漏第三方视角。
func botPayloadTweet(dto apptweet.TweetDTO) apptweet.TweetDTO {
	dto.IsLiked = false
	return dto
}

// actor 读取互动者；缺失、已注销或本身是 bot 时返回 nil（丢弃事件）。
func (s *tweetBotEventSubscriber) actor(ctx context.Context, id shared.ID) *domainuser.User {
	user, err := s.users.FindByID(ctx, id)
	if err != nil {
		s.log.Warn().Err(err).Str("user_id", id.String()).Msg("推文互动者资料读取失败")
		return nil
	}
	if user.IsDeleted() || user.IsBot() {
		return nil
	}
	return user
}

// push 按虚拟用户反查 bot 凭证并投递；没有凭证或已禁用时静默跳过。
func (s *tweetBotEventSubscriber) push(ctx context.Context, userID shared.ID, event appchat.EventDTO) {
	bot, err := s.bots.FindByUserID(ctx, userID)
	if errors.Is(err, domainchat.ErrBotNotFound) {
		return
	}
	if err != nil {
		s.log.Warn().Err(err).Str("user_id", userID.String()).Msg("推文事件接收者 bot 凭证查询失败")
		return
	}
	if !bot.IsEnabled() {
		return
	}
	s.pusher.Push(bot.ID(), event)
}
