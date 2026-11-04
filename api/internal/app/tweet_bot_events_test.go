package app

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appchat "blog-api/internal/application/chat"
	apptweet "blog-api/internal/application/tweet"
	domainchat "blog-api/internal/domain/chat"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
)

type fakeTweetEventReader struct {
	tweets   map[string]apptweet.TweetDTO
	comments map[string]apptweet.CommentDTO
}

func (f *fakeTweetEventReader) GetByID(_ context.Context, id string) (apptweet.TweetDTO, error) {
	if tw, ok := f.tweets[id]; ok {
		return tw, nil
	}
	return apptweet.TweetDTO{}, domaintweet.ErrNotFound
}

func (f *fakeTweetEventReader) GetComment(_ context.Context, id string) (apptweet.CommentDTO, error) {
	if c, ok := f.comments[id]; ok {
		return c, nil
	}
	return apptweet.CommentDTO{}, domaintweet.ErrCommentNotFound
}

type fakeBotRepo struct {
	domainchat.BotRepository
	byUser map[string]*domainchat.Bot
}

func (f *fakeBotRepo) FindByUserID(_ context.Context, userID shared.ID) (*domainchat.Bot, error) {
	if bot, ok := f.byUser[userID.String()]; ok {
		return bot, nil
	}
	return nil, domainchat.ErrBotNotFound
}

type fakeUserReader struct {
	byID map[string]*domainuser.User
}

func (f *fakeUserReader) FindByID(_ context.Context, id shared.ID) (*domainuser.User, error) {
	if u, ok := f.byID[id.String()]; ok {
		return u, nil
	}
	return nil, domainuser.ErrNotFound
}

type pushedEvent struct {
	botID shared.ID
	event appchat.EventDTO
}

type fakePusher struct {
	pushes []pushedEvent
}

func (f *fakePusher) Push(botID shared.ID, event appchat.EventDTO) {
	f.pushes = append(f.pushes, pushedEvent{botID: botID, event: event})
}

func newHuman(t *testing.T, id shared.ID, username string) *domainuser.User {
	t.Helper()
	email, err := domainuser.ParseEmail(username + "@example.com")
	require.NoError(t, err)
	name, err := domainuser.ParseUsername(username)
	require.NoError(t, err)
	return domainuser.NewUser(id, email, name, domainuser.NewPasswordHash("x"))
}

// newBotForUser 造一个凭证与指定虚拟用户绑定的 bot。
func newBotForUser(t *testing.T, userID shared.ID, enabled bool) *domainchat.Bot {
	t.Helper()
	bot, _, err := domainchat.NewBot(shared.NewID(), userID, "helperbot", nil, time.Now())
	require.NoError(t, err)
	if !enabled {
		bot.Disable(time.Now())
	}
	return bot
}

type subscriberFixture struct {
	sub     *tweetBotEventSubscriber
	reader  *fakeTweetEventReader
	bots    *fakeBotRepo
	users   *fakeUserReader
	pusher  *fakePusher
	quoted  apptweet.TweetDTO
	comment apptweet.CommentDTO
}

func newSubscriberFixture(t *testing.T, recipients map[string]*domainchat.Bot, actors ...*domainuser.User) *subscriberFixture {
	t.Helper()
	reader := &fakeTweetEventReader{tweets: map[string]apptweet.TweetDTO{}, comments: map[string]apptweet.CommentDTO{}}
	bots := &fakeBotRepo{byUser: recipients}
	users := &fakeUserReader{byID: map[string]*domainuser.User{}}
	for _, u := range actors {
		users.byID[u.GetID().String()] = u
	}
	pusher := &fakePusher{}
	sub := NewTweetBotEventSubscriber(reader, bots, users, pusher, zerolog.Nop())
	sub.now = func() time.Time { return time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC) }
	return &subscriberFixture{sub: sub, reader: reader, bots: bots, users: users, pusher: pusher}
}

func TestTweetBotEvents_CommentNotifiesAuthorAndRepliedTo(t *testing.T) {
	tweetAuthorID := shared.NewID()
	replierAuthorID := shared.NewID()
	actorID := shared.NewID()

	f := newSubscriberFixture(t, map[string]*domainchat.Bot{
		tweetAuthorID.String():   newBotForUser(t, tweetAuthorID, true),
		replierAuthorID.String(): newBotForUser(t, replierAuthorID, true),
	}, newHuman(t, actorID, "reader"))

	tweetID := shared.NewID()
	f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String(), IsLiked: true}
	comment, err := domaintweet.NewComment(tweetID, actorID, "好文")
	require.NoError(t, err)
	require.NoError(t, comment.SetParent(nil))
	f.reader.comments[comment.ID().String()] = apptweet.CommentDTO{ID: comment.ID().String(), TweetID: tweetID.String()}
	repliedTo := replierAuthorID
	event := domaintweet.NewTweetCommented(comment, tweetAuthorID, &repliedTo)

	require.NoError(t, f.sub.handle(context.Background(), event))

	require.Len(t, f.pusher.pushes, 2)
	assert.Equal(t, "tweet.commented", f.pusher.pushes[0].event.Type)
	assert.Equal(t, "comment_on_tweet", f.pusher.pushes[0].event.Data["reason"])
	assert.Equal(t, tweetID.String(), f.pusher.pushes[0].event.Data["tweet"].(apptweet.TweetDTO).ID)
	assert.False(t, f.pusher.pushes[0].event.Data["tweet"].(apptweet.TweetDTO).IsLiked, "载荷不得携带互动者的点赞状态")
	assert.Equal(t, "reply_to_comment", f.pusher.pushes[1].event.Data["reason"])
	assert.Equal(t, "2026-11-04T12:00:00Z", f.pusher.pushes[0].event.OccurredAt)
}

func TestTweetBotEvents_CommentDedupesSameRecipient(t *testing.T) {
	authorID := shared.NewID()
	actorID := shared.NewID()
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{
		authorID.String(): newBotForUser(t, authorID, true),
	}, newHuman(t, actorID, "reader"))

	tweetID := shared.NewID()
	f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String()}
	comment, err := domaintweet.NewComment(tweetID, actorID, "自评论")
	require.NoError(t, err)
	require.NoError(t, comment.SetParent(nil))
	f.reader.comments[comment.ID().String()] = apptweet.CommentDTO{ID: comment.ID().String(), TweetID: tweetID.String()}
	repliedTo := authorID
	event := domaintweet.NewTweetCommented(comment, authorID, &repliedTo)

	require.NoError(t, f.sub.handle(context.Background(), event))

	require.Len(t, f.pusher.pushes, 1)
	assert.Equal(t, "comment_on_tweet", f.pusher.pushes[0].event.Data["reason"])
}

func TestTweetBotEvents_QuoteNotifiesQuotedAuthor(t *testing.T) {
	quotedAuthorID := shared.NewID()
	actorID := shared.NewID()
	quotedBot := newBotForUser(t, quotedAuthorID, true)
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{quotedAuthorID.String(): quotedBot}, newHuman(t, actorID, "quoter"))

	quotedID := shared.NewID()
	quoteID := shared.NewID()
	f.reader.tweets[quotedID.String()] = apptweet.TweetDTO{ID: quotedID.String(), IsLiked: true}
	f.reader.tweets[quoteID.String()] = apptweet.TweetDTO{ID: quoteID.String(), IsLiked: true}

	quoted := domaintweet.ReconstructTweet(quotedID, quotedAuthorID, "原推", nil, nil, 0, time.Now(), time.Now())
	quote := domaintweet.ReconstructTweet(quoteID, actorID, "感想", nil, nil, 0, time.Now(), time.Now())

	require.NoError(t, f.sub.handle(context.Background(), domaintweet.NewTweetQuoted(quoted, quote)))

	require.Len(t, f.pusher.pushes, 1)
	event := f.pusher.pushes[0].event
	assert.Equal(t, quotedBot.ID(), f.pusher.pushes[0].botID)
	assert.Equal(t, "tweet.quoted", event.Type)
	assert.Equal(t, quotedID.String(), event.Data["quoted_tweet"].(apptweet.TweetDTO).ID)
	assert.Equal(t, quoteID.String(), event.Data["quote"].(apptweet.TweetDTO).ID)
	assert.False(t, event.Data["quoted_tweet"].(apptweet.TweetDTO).IsLiked)
	assert.False(t, event.Data["quote"].(apptweet.TweetDTO).IsLiked)
}

func TestTweetBotEvents_LikeNotifiesAuthorWithActor(t *testing.T) {
	authorID := shared.NewID()
	actorID := shared.NewID()
	bot := newBotForUser(t, authorID, true)
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{authorID.String(): bot}, newHuman(t, actorID, "liker"))

	tweetID := shared.NewID()
	f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String(), IsLiked: true}
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "被赞", nil, nil, 0, time.Now(), time.Now())

	require.NoError(t, f.sub.handle(context.Background(), domaintweet.NewTweetLiked(tweet, actorID)))

	require.Len(t, f.pusher.pushes, 1)
	event := f.pusher.pushes[0].event
	assert.Equal(t, "tweet.liked", event.Type)
	assert.Equal(t, tweetID.String(), event.Data["tweet"].(apptweet.TweetDTO).ID)
	assert.False(t, event.Data["tweet"].(apptweet.TweetDTO).IsLiked)
	actor := event.Data["actor"].(map[string]any)
	assert.Equal(t, actorID.String(), actor["id"])
	assert.Equal(t, "liker", actor["username"])
	assert.Equal(t, "liker", actor["display_name"])
}

func TestTweetBotEvents_DropsBotActor(t *testing.T) {
	authorID := shared.NewID()
	actor := newHuman(t, shared.NewID(), "botactor")
	// 把互动者伪装成 bot 虚拟用户。
	email, err := domainuser.ParseEmail("bot+" + actor.GetID().String() + "@" + domainuser.BotUserEmailDomain)
	require.NoError(t, err)
	botUser := domainuser.NewUser(actor.GetID(), email, actor.Username(), domainuser.NewPasswordHash(""))
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{authorID.String(): newBotForUser(t, authorID, true)}, botUser)

	tweetID := shared.NewID()
	f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String()}
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "x", nil, nil, 0, time.Now(), time.Now())

	require.NoError(t, f.sub.handle(context.Background(), domaintweet.NewTweetLiked(tweet, botUser.GetID())))
	assert.Empty(t, f.pusher.pushes)
}

func TestTweetBotEvents_DropsSelfInteraction(t *testing.T) {
	authorID := shared.NewID()
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{authorID.String(): newBotForUser(t, authorID, true)},
		newHuman(t, authorID, "author"))

	tweetID := shared.NewID()
	f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String()}
	tweet := domaintweet.ReconstructTweet(tweetID, authorID, "x", nil, nil, 0, time.Now(), time.Now())

	require.NoError(t, f.sub.handle(context.Background(), domaintweet.NewTweetLiked(tweet, authorID)))
	assert.Empty(t, f.pusher.pushes)
}

func TestTweetBotEvents_DropsDisabledOrCredentialless(t *testing.T) {
	disabledID := shared.NewID()
	noCredentialID := shared.NewID()
	actorID := shared.NewID()
	f := newSubscriberFixture(t, map[string]*domainchat.Bot{
		disabledID.String(): newBotForUser(t, disabledID, false),
	}, newHuman(t, actorID, "reader"))

	for _, authorID := range []shared.ID{disabledID, noCredentialID} {
		tweetID := shared.NewID()
		f.reader.tweets[tweetID.String()] = apptweet.TweetDTO{ID: tweetID.String()}
		tweet := domaintweet.ReconstructTweet(tweetID, authorID, "x", nil, nil, 0, time.Now(), time.Now())
		require.NoError(t, f.sub.handle(context.Background(), domaintweet.NewTweetLiked(tweet, actorID)))
	}
	assert.Empty(t, f.pusher.pushes)
}
