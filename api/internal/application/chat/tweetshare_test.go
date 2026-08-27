package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
)

type shareTweetRepo struct {
	tweets map[domainshared.ID]*domaintweet.Tweet
}

func (r *shareTweetRepo) FindByID(_ context.Context, id domainshared.ID) (*domaintweet.Tweet, error) {
	if t, ok := r.tweets[id]; ok {
		return t, nil
	}
	return nil, domaintweet.ErrNotFound
}

func newShareService(t *testing.T, tweet *domaintweet.Tweet, userID, authorID, conversationID domainshared.ID) (*Service, *replyChatRepo) {
	t.Helper()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	conversation, err := domainchat.NewConversation(domainchat.ConversationDirect, userID, "", now)
	if err != nil {
		t.Fatal(err)
	}
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberOwner, now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &replyChatRepo{conversation: conversation, member: member}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{
		userID:   newReplyUser(userID, "alice"),
		authorID: newReplyUser(authorID, "bob"),
	}}
	tweets := &shareTweetRepo{tweets: map[domainshared.ID]*domaintweet.Tweet{}}
	if tweet != nil {
		tweets.tweets[tweet.ID()] = tweet
	}
	svc := NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, tweets, nil)
	return svc, repo
}

func TestSendMessageIncludesSharedTweetSnapshot(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	authorID := domainshared.NewID()
	tweet, err := domaintweet.NewTweet(authorID, "快来看这条推文", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	svc, repo := newShareService(t, tweet, userID, authorID, conversationID)

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageTweetShare,
		Content:        "你看这条",
		SharedTweetID:  tweet.ID(),
		IdempotencyKey: "share-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.saved == nil || repo.saved.SharedTweetID() == nil || !repo.saved.SharedTweetID().Equal(tweet.ID()) {
		t.Fatal("expected saved message to keep its shared tweet reference")
	}
	if got.Content != "你看这条" {
		t.Fatalf("caption = %q, want %q", got.Content, "你看这条")
	}
	if got.SharedTweet == nil || got.SharedTweet.IsDeleted {
		t.Fatal("expected a live shared tweet snapshot")
	}
	if got.SharedTweet.Content != "快来看这条推文" {
		t.Fatalf("shared tweet content = %q, want %q", got.SharedTweet.Content, "快来看这条推文")
	}
	if got.SharedTweet.Author == nil || got.SharedTweet.Author.Username != "bob" {
		t.Fatalf("shared tweet author = %+v, want username bob", got.SharedTweet.Author)
	}
}

func TestSendMessageRejectsMissingSharedTweet(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageTweetShare,
		SharedTweetID:  domainshared.NewID(),
		IdempotencyKey: "share-missing",
	})
	if err == nil {
		t.Fatal("expected sharing a nonexistent tweet to be rejected")
	}
	if repo.saved != nil {
		t.Fatal("missing shared tweet must not save a message")
	}
}

func TestListMessagesRedactsDeletedSharedTweet(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	authorID := domainshared.NewID()
	now := time.Date(2026, 8, 21, 10, 0, 0, 0, time.UTC)
	tweetID := domainshared.NewID()
	share, err := domainchat.NewTweetShareMessage(conversationID, userID, tweetID, "", "share-deleted", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	// 被分享的推文已物理删除：仓储中不存在该 ID，联结应返回占位而非报错。
	svc, repo := newShareService(t, nil, userID, authorID, conversationID)
	repo.saved = share

	result, err := svc.ListMessages(context.Background(), userID, conversationID, "", 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].SharedTweet == nil {
		t.Fatal("expected a deleted shared tweet placeholder")
	}
	if !result.Items[0].SharedTweet.IsDeleted || result.Items[0].SharedTweet.Content != "" {
		t.Fatalf("deleted shared tweet placeholder = %+v, want redacted", result.Items[0].SharedTweet)
	}
}
