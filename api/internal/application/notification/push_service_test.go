package notification

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// fakePushRepo 内存订阅表，按 endpoint 唯一。
type fakePushRepo struct {
	subs map[domainshared.ID][]*domainnotification.PushSubscription
}

func newFakePushRepo() *fakePushRepo {
	return &fakePushRepo{subs: map[domainshared.ID][]*domainnotification.PushSubscription{}}
}

func (f *fakePushRepo) Save(_ context.Context, sub *domainnotification.PushSubscription) error {
	for i, existing := range f.subs[sub.UserID] {
		if existing.Endpoint == sub.Endpoint {
			f.subs[sub.UserID][i] = sub
			return nil
		}
	}
	f.subs[sub.UserID] = append(f.subs[sub.UserID], sub)
	return nil
}

func (f *fakePushRepo) Delete(_ context.Context, userID domainshared.ID, endpoint string) error {
	subs := f.subs[userID]
	for i, sub := range subs {
		if sub.Endpoint == endpoint {
			f.subs[userID] = append(subs[:i], subs[i+1:]...)
			return nil
		}
	}
	return nil
}

func (f *fakePushRepo) ListByUser(_ context.Context, userID domainshared.ID) ([]*domainnotification.PushSubscription, error) {
	return f.subs[userID], nil
}

// stubSender 按 endpoint 预设错误，记录成功投递。
type stubSender struct {
	errByEndpoint map[string]error
	delivered     []BrowserNotification
}

func (s *stubSender) Send(_ context.Context, sub *domainnotification.PushSubscription, n BrowserNotification) error {
	if err := s.errByEndpoint[sub.Endpoint]; err != nil {
		return err
	}
	s.delivered = append(s.delivered, n)
	return nil
}

func newPushService(repo domainnotification.PushSubscriptionRepository, sender WebPushSender) *PushService {
	return NewPushService(repo, sender, "test-public-key", nil, zerolog.Nop())
}

func TestPushService_SubscribeIsIdempotentPerEndpoint(t *testing.T) {
	repo := newFakePushRepo()
	svc := newPushService(repo, &stubSender{})
	userID := domainshared.NewID()

	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "key", "auth", "chrome"))
	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "key2", "auth2", "chrome"))
	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/b", "key", "auth", "firefox"))

	subs, err := repo.ListByUser(context.Background(), userID)
	require.NoError(t, err)
	require.Len(t, subs, 2, "同一 endpoint 重复授权覆盖而非追加")
	assert.Equal(t, "key2", subs[0].P256DH)
}

func TestPushService_SubscribeRejectsIncompleteCredentials(t *testing.T) {
	svc := newPushService(newFakePushRepo(), &stubSender{})
	userID := domainshared.NewID()

	require.Error(t, svc.Subscribe(context.Background(), userID, "", "key", "auth", ""))
	require.Error(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "", "auth", ""))
	require.Error(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "key", "", ""))
}

func TestPushService_PushBrowserFansOutToAllDevices(t *testing.T) {
	repo := newFakePushRepo()
	sender := &stubSender{}
	svc := newPushService(repo, sender)
	userID := domainshared.NewID()
	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "k", "a", ""))
	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/b", "k", "a", ""))

	svc.PushBrowser(context.Background(), userID, BrowserNotification{
		SourceType: domainnotification.SourceTweetLiked, Title: "Alice 赞了你的推文", URL: "/tweets/1",
	})

	require.Len(t, sender.delivered, 2)
	assert.Equal(t, "/tweets/1", sender.delivered[0].URL)
}

// 订阅确认失效（410/404）时删除该行；其他错误保留订阅供后续通知复用。
func TestPushService_PushBrowserPrunesOnlyExpiredSubscriptions(t *testing.T) {
	for _, tc := range []struct {
		name      string
		err       error
		remaining int
	}{
		{"expired", fmt.Errorf("provider: %w", ErrPushSubscriptionExpired), 1},
		{"transient", errors.New("web push returned 503"), 2},
		{"canceled", context.Canceled, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := newFakePushRepo()
			sender := &stubSender{errByEndpoint: map[string]error{"https://push.example/bad": tc.err}}
			svc := newPushService(repo, sender)
			userID := domainshared.NewID()
			require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/bad", "k", "a", ""))
			require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/ok", "k", "a", ""))

			svc.PushBrowser(context.Background(), userID, BrowserNotification{Title: "标题"})

			subs, err := repo.ListByUser(context.Background(), userID)
			require.NoError(t, err)
			assert.Len(t, subs, tc.remaining)
			assert.Len(t, sender.delivered, 1, "健康订阅仍送达")
		})
	}
}

// 未配置 VAPID 密钥时只存订阅不投递，避免无意义的空发送。
func TestPushService_DisabledWithoutSender(t *testing.T) {
	repo := newFakePushRepo()
	svc := NewPushService(repo, nil, "", nil, zerolog.Nop())
	userID := domainshared.NewID()
	require.NoError(t, svc.Subscribe(context.Background(), userID, "https://push.example/a", "k", "a", ""))

	assert.False(t, svc.Enabled())
	assert.Empty(t, svc.PublicKey())
	svc.PushBrowser(context.Background(), userID, BrowserNotification{Title: "标题"})
}

func TestNotificationURL(t *testing.T) {
	tweetID := domainshared.NewID().String()
	for _, tc := range []struct {
		name       string
		sourceType domainnotification.SourceType
		payload    map[string]any
		want       string
	}{
		{"推文点赞", domainnotification.SourceTweetLiked, map[string]any{"tweet_id": tweetID}, "/tweets/" + tweetID},
		{"推文评论", domainnotification.SourceTweetCommented, map[string]any{"tweet_id": tweetID}, "/tweets/" + tweetID},
		{"评论被回复", domainnotification.SourceTweetCommentReplied, map[string]any{"tweet_id": tweetID}, "/tweets/" + tweetID},
		{"推文被转发", domainnotification.SourceTweetQuoted, map[string]any{"tweet_id": tweetID}, "/tweets/" + tweetID},
		{"推文 id 缺失回落时间线", domainnotification.SourceTweetLiked, map[string]any{}, "/tweets"},
		{"聊天邀请", domainnotification.SourceChatRoomInvited, map[string]any{"conversation_id": "c1"}, "/chat?c=c1"},
		{"其他来源回落首页", domainnotification.SourceUserRegistered, map[string]any{}, "/"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, notificationURL(tc.sourceType, tc.payload))
		})
	}
}
