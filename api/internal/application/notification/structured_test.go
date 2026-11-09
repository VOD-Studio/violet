package notification

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	domainchat "blog-api/internal/domain/chat"
	domaincomment "blog-api/internal/domain/comment"
	domainfriendlink "blog-api/internal/domain/friendlink"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	domainwindow "blog-api/internal/domain/window"
)

// --- oneLine ---

func TestOneLine(t *testing.T) {
	long := strings.Repeat("字", 100)
	emojiLong := strings.Repeat("😀", 100)

	tests := []struct {
		name string
		in   string
		max  int
		want string
	}{
		{"空串", "", 80, ""},
		{"纯空白", " \n\t ", 80, ""},
		{"换行与连续空白折叠为单空格", "第一行\n\n  第二行\t第三行  ", 80, "第一行 第二行 第三行"},
		{"CRLF", "a\r\nb", 80, "a b"},
		{"不超长原样返回", "短文本", 80, "短文本"},
		{"恰好等于上限不截断", strings.Repeat("字", 80), 80, strings.Repeat("字", 80)},
		{"中文按 rune 截断并补省略号", long, 80, strings.Repeat("字", 80) + "…"},
		{"emoji 按 rune 截断", emojiLong, 5, strings.Repeat("😀", 5) + "…"},
		{"截断点落在空格后不留尾部空格", "ab cd ef", 3, "ab…"},
		{"折叠后再算长度", "a\n\n\n\nb", 3, "a b"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := oneLine(tt.in, tt.max)
			assert.Equal(t, tt.want, got)
			assert.True(t, utf8.ValidString(got), "截断不能切坏多字节字符")
			assert.NotContains(t, got, "\n")
		})
	}
}

// --- payload 提升 ---

// 旧通知（payload 无保留键）读出的结构化字段全空，JSON 中不出现对应键。
func TestStructuredFromPayload_LegacyRowHasNoStructuredFields(t *testing.T) {
	dto := toDTO(domainnotification.Reconstruct(
		newID(), newID(), newID(), domainnotification.SourceCommentApproved, newID(),
		"你的评论已审核通过", "", map[string]any{"comment_id": "c1"}, nil, time.Now(),
	))

	assert.Equal(t, Structured{}, dto.Structured)
	raw, err := json.Marshal(dto)
	require.NoError(t, err)
	assert.NotContains(t, string(raw), `"actor"`)
	assert.NotContains(t, string(raw), `"object_title"`)
	assert.NotContains(t, string(raw), `"quote"`)
	assert.Contains(t, string(raw), `"comment_id":"c1"`, "旧 payload 原样保留")
}

// --- 每种来源类型的结构化字段（经 JSON 往返模拟落库再读出） ---

// fakeCommentContextLookup 按评论 ID 固定返回评论上下文。
type fakeCommentContextLookup struct {
	cc  CommentContext
	err error
}

func (f fakeCommentContextLookup) FindCommentContext(context.Context, domainshared.ID) (CommentContext, error) {
	return f.cc, f.err
}

// viaDB 模拟持久化往返：payload 经 JSON 序列化再反序列化后重建通知，
// 与 GORM 仓储读回 jsonb 的形态一致（对象 → map[string]any，数字 → float64）。
func viaDB(t *testing.T, n *domainnotification.Notification) *domainnotification.Notification {
	t.Helper()
	raw, err := json.Marshal(n.Payload())
	require.NoError(t, err)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(raw, &payload))
	return domainnotification.Reconstruct(n.GetID(), n.UserID(), n.EventID(), n.SourceType(), n.SourceID(),
		n.Title(), n.Body(), payload, nil, n.CreatedAt())
}

func structuredCommentContext() CommentContext {
	return CommentContext{
		AuthorName:      "Bob",
		AuthorAvatarURL: "https://cdn.example/bob.png",
		PostTitle:       "Go 并发笔记",
		Content:         "写得真好\n学到了很多",
	}
}

func TestSubscriber_StructuredFields_EverySourceType(t *testing.T) {
	alice := &Actor{Name: "Alice", AvatarURL: "https://cdn.example/alice.png"}
	bob := &Actor{Name: "Bob", AvatarURL: "https://cdn.example/bob.png"}
	adminID, ownerID, postAuthorID, commentAuthorID, applicantID := newID(), newID(), newID(), newID(), newID()
	commentID, tweetAuthorID, actorID := newID(), newID(), newID()
	tweet := newTweet(t, tweetAuthorID, "今天写了点代码")
	quoteTweet := newTweet(t, actorID, "转发\n说两句")
	tweetComment, err := domaintweet.NewComment(tweet.ID(), actorID, "说得好\n同意")
	require.NoError(t, err)
	registeredID := newID()

	tests := []struct {
		name       string
		event      domainshared.DomainEvent
		wantType   domainnotification.SourceType
		wantUserID domainshared.ID
		want       Structured
	}{
		{
			name:       "subscription_failed",
			event:      domainsubscription.NewSubscriptionFetched(newID(), "少数派", false, 0, 1, "源站连接失败", "transient", true, false),
			wantType:   domainnotification.SourceSubscriptionFailed,
			wantUserID: ownerID,
			want:       Structured{ObjectTitle: "少数派", Quote: "源站连接失败"},
		},
		{
			name:       "subscription_succeeded",
			event:      domainsubscription.NewSubscriptionFetched(newID(), "少数派", true, 3, 0, "", "", false, false),
			wantType:   domainnotification.SourceSubscriptionSucceeded,
			wantUserID: ownerID,
			want:       Structured{ObjectTitle: "少数派"},
		},
		{
			name:       "friendlink_applied",
			event:      domainfriendlink.NewFriendLinkCreated(newID(), "测试站", "https://example.com", "一个测试站点"),
			wantType:   domainnotification.SourceFriendLinkApplied,
			wantUserID: adminID,
			want:       Structured{ObjectTitle: "测试站", Quote: "一个测试站点"},
		},
		{
			name:       "friendlink_reviewed_approved",
			event:      domainfriendlink.NewFriendLinkApproved(newID(), "测试站", "pending", "一个测试站点"),
			wantType:   domainnotification.SourceFriendLinkReviewed,
			wantUserID: applicantID,
			want:       Structured{ObjectTitle: "测试站", Quote: "一个测试站点"},
		},
		{
			name:       "friendlink_reviewed_rejected",
			event:      domainfriendlink.NewFriendLinkRejected(newID(), "测试站", "pending", ""),
			wantType:   domainnotification.SourceFriendLinkReviewed,
			wantUserID: applicantID,
			want:       Structured{ObjectTitle: "测试站"},
		},
		{
			name:       "comment_pending",
			event:      domaincomment.NewCommentSubmitted(commentID),
			wantType:   domainnotification.SourceCommentPending,
			wantUserID: adminID,
			want:       Structured{Actor: bob, ObjectTitle: "Go 并发笔记", Quote: "写得真好 学到了很多"},
		},
		{
			name:       "comment_created",
			event:      domaincomment.NewCommentApproved(commentID),
			wantType:   domainnotification.SourceCommentCreated,
			wantUserID: postAuthorID,
			want:       Structured{Actor: bob, ObjectTitle: "Go 并发笔记", Quote: "写得真好 学到了很多"},
		},
		{
			name:       "comment_approved",
			event:      domaincomment.NewCommentApproved(commentID),
			wantType:   domainnotification.SourceCommentApproved,
			wantUserID: commentAuthorID,
			want:       Structured{ObjectTitle: "Go 并发笔记", Quote: "写得真好 学到了很多"},
		},
		{
			name:       "comment_rejected",
			event:      domaincomment.NewCommentSpammed(commentID),
			wantType:   domainnotification.SourceCommentRejected,
			wantUserID: commentAuthorID,
			want:       Structured{ObjectTitle: "Go 并发笔记", Quote: "写得真好 学到了很多"},
		},
		{
			name:       "user_registered",
			event:      domainuser.NewUserRegistered(registeredID, mustEmail(t, "new@example.com")),
			wantType:   domainnotification.SourceUserRegistered,
			wantUserID: adminID,
			want:       Structured{Actor: alice},
		},
		{
			name:       "account_security",
			event:      domainuser.NewUserPasswordChanged(ownerID),
			wantType:   domainnotification.SourceAccountSecurity,
			wantUserID: ownerID,
			want:       Structured{},
		},
		{
			name:       "account_security_api_token",
			event:      domainapitoken.NewPATCreated(ownerID, "ci"),
			wantType:   domainnotification.SourceAccountSecurity,
			wantUserID: ownerID,
			want:       Structured{},
		},
		{
			name:       "chat_room_invited",
			event:      domainchat.NewRoomInvited(newID(), actorID, ownerID, "周末开黑"),
			wantType:   domainnotification.SourceChatRoomInvited,
			wantUserID: ownerID,
			want:       Structured{Actor: alice, ObjectTitle: "周末开黑"},
		},
		{
			name:       "tweet_liked",
			event:      domaintweet.NewTweetLiked(tweet, actorID),
			wantType:   domainnotification.SourceTweetLiked,
			wantUserID: tweetAuthorID,
			want:       Structured{Actor: alice, ObjectTitle: "今天写了点代码"},
		},
		{
			name:       "tweet_quoted",
			event:      domaintweet.NewTweetQuoted(tweet, quoteTweet),
			wantType:   domainnotification.SourceTweetQuoted,
			wantUserID: tweetAuthorID,
			want:       Structured{Actor: alice, ObjectTitle: "今天写了点代码", Quote: "转发 说两句"},
		},
		{
			name:       "tweet_commented",
			event:      domaintweet.NewTweetCommented(tweetComment, tweet, nil),
			wantType:   domainnotification.SourceTweetCommented,
			wantUserID: tweetAuthorID,
			want:       Structured{Actor: alice, ObjectTitle: "今天写了点代码", Quote: "说得好 同意"},
		},
		{
			name:       "tweet_comment_replied",
			event:      domaintweet.NewTweetCommented(tweetComment, tweet, &commentAuthorID),
			wantType:   domainnotification.SourceTweetCommentReplied,
			wantUserID: commentAuthorID,
			want:       Structured{Actor: alice, ObjectTitle: "今天写了点代码", Quote: "说得好 同意"},
		},
		{
			name:       "window_knocked",
			event:      domainwindow.NewKnocked("/posts/a"),
			wantType:   domainnotification.SourceWindowKnocked,
			wantUserID: adminID,
			want:       Structured{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeStoreCorrect{}
			lookups := stubLookups()
			lookups.SubscriptionOwner = &fakeSubLookup{ownerID: ownerID}
			lookups.CommentAuthor = &fakeCommentLookup{authorID: &commentAuthorID}
			lookups.AdminUsers = &fakeAdminLookup{ids: []domainshared.ID{adminID}}
			lookups.FriendLinkApplicant = &fakeFriendlinkLookup{applicantID: &applicantID}
			lookups.CommentPostAuthor = &fakePostAuthorLookup{authorID: &postAuthorID}
			lookups.CommentContext = fakeCommentContextLookup{cc: structuredCommentContext()}
			sub := NewSubscriber(store, lookups, zerolog.Nop())

			require.NoError(t, sub.Handle(context.Background(), tt.event))

			// 评论审核通过会同时通知文章作者；这里只取目标接收者那一行
			var got *domainnotification.Notification
			for _, n := range store.saved {
				if n.UserID() == tt.wantUserID && n.SourceType() == tt.wantType {
					got = n
				}
			}
			require.NotNil(t, got, "应产生 %s 通知给目标接收者", tt.wantType)
			assert.True(t, domainnotification.IsValidSourceType(got.SourceType()))

			dto := toDTO(viaDB(t, got))
			assert.Equal(t, tt.want, dto.Structured)
			assert.Equal(t, got.Title(), dto.Title, "旧字段 title 不变")
			assert.Equal(t, got.Body(), dto.Body, "旧字段 body 不变")
		})
	}
}

// 评论通过：文章作者那一行是 comment_created，行为人是评论者，且与评论作者那一行的字段互不串扰。
func TestSubscriber_StructuredFields_CommentApprovedFansOutPerRecipient(t *testing.T) {
	store := &fakeStoreCorrect{}
	commentAuthorID, postAuthorID := newID(), newID()
	lookups := stubLookups()
	lookups.CommentAuthor = &fakeCommentLookup{authorID: &commentAuthorID}
	lookups.CommentPostAuthor = &fakePostAuthorLookup{authorID: &postAuthorID}
	lookups.CommentContext = fakeCommentContextLookup{cc: structuredCommentContext()}
	sub := NewSubscriber(store, lookups, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domaincomment.NewCommentApproved(newID())))

	require.Len(t, store.saved, 2)
	own, created := toDTO(viaDB(t, store.saved[0])), toDTO(viaDB(t, store.saved[1]))
	assert.Equal(t, "comment_approved", own.SourceType)
	assert.Nil(t, own.Actor, "给评论作者本人的审核结果没有行为人")
	assert.Equal(t, "comment_created", created.SourceType)
	require.NotNil(t, created.Actor)
	assert.Equal(t, "Bob", created.Actor.Name)
	assert.Equal(t, "https://cdn.example/bob.png", created.Actor.AvatarURL)
	assert.Equal(t, "Go 并发笔记", created.ObjectTitle)
}

// 评论上下文查不到（出错）时通知照常发出，只是没有结构化字段——通知比摘录重要。
func TestSubscriber_StructuredFields_CommentContextFailureStillNotifies(t *testing.T) {
	store := &fakeStoreCorrect{}
	adminID := newID()
	lookups := stubLookups()
	lookups.AdminUsers = &fakeAdminLookup{ids: []domainshared.ID{adminID}}
	lookups.CommentContext = fakeCommentContextLookup{err: errors.New("db down")}
	sub := NewSubscriber(store, lookups, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domaincomment.NewCommentSubmitted(newID())))

	require.Len(t, store.saved, 1)
	assert.Equal(t, "有新评论待审核", store.saved[0].Title())
	assert.Equal(t, Structured{}, toDTO(viaDB(t, store.saved[0])).Structured)
}

// 行为人查不到资料：不伪造行为人，标题仍用兜底称呼。
func TestSubscriber_StructuredFields_UnknownActorOmitted(t *testing.T) {
	store := &fakeStoreCorrect{}
	lookups := stubLookups()
	lookups.Actor = emptyActorLookup{}
	sub := NewSubscriber(store, lookups, zerolog.Nop())
	tw := newTweet(t, newID(), "内容")

	require.NoError(t, sub.Handle(context.Background(), domaintweet.NewTweetLiked(tw, newID())))

	require.Len(t, store.saved, 1)
	dto := toDTO(viaDB(t, store.saved[0]))
	assert.Nil(t, dto.Actor)
	assert.Equal(t, "内容", dto.ObjectTitle)
}

// 行为人只有名字没有头像（匿名评论者）：actor 只含 name。
func TestSubscriber_StructuredFields_ActorWithoutAvatar(t *testing.T) {
	store := &fakeStoreCorrect{}
	adminID := newID()
	lookups := stubLookups()
	lookups.AdminUsers = &fakeAdminLookup{ids: []domainshared.ID{adminID}}
	lookups.CommentContext = fakeCommentContextLookup{cc: CommentContext{AuthorName: "路人", PostTitle: "文", Content: "嗯"}}
	sub := NewSubscriber(store, lookups, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domaincomment.NewCommentSubmitted(newID())))

	require.Len(t, store.saved, 1)
	raw, err := json.Marshal(toDTO(viaDB(t, store.saved[0])))
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"actor":{"name":"路人"}`)
}

// 过长的评论摘录按 rune 截断到 80 个字符并以省略号结尾。
func TestSubscriber_StructuredFields_QuoteTruncatedByRunes(t *testing.T) {
	store := &fakeStoreCorrect{}
	lookups := stubLookups()
	lookups.AdminUsers = &fakeAdminLookup{ids: []domainshared.ID{newID()}}
	lookups.CommentContext = fakeCommentContextLookup{cc: CommentContext{
		AuthorName: "Bob", PostTitle: "文", Content: strings.Repeat("好😀", 100),
	}}
	sub := NewSubscriber(store, lookups, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domaincomment.NewCommentSubmitted(newID())))

	quote := toDTO(viaDB(t, store.saved[0])).Quote
	assert.True(t, utf8.ValidString(quote))
	assert.Equal(t, quoteMaxRunes+1, utf8.RuneCountInString(quote))
	assert.True(t, strings.HasSuffix(quote, "…"))
}

// --- 列表与 SSE 同源 ---

// 实时推送的 SSE 事件与随后列表读出的同一通知带有完全相同的结构化字段。
func TestPushingSubscriber_SSEEventMatchesListReadModel(t *testing.T) {
	store := &fakeStoreCorrect{}
	notif := &fakeNotifier{}
	authorID := newID()
	tw := newTweet(t, authorID, "今天写了点代码")
	quote := newTweet(t, newID(), "转发\n说两句")
	sub := NewPushingSubscriber(store, stubLookups(), notif, nil, zerolog.Nop())

	require.NoError(t, sub.Handle(context.Background(), domaintweet.NewTweetQuoted(tw, quote)))

	require.Len(t, notif.events, 1)
	event := notif.events[0]
	assert.Equal(t, &Actor{Name: "Alice", AvatarURL: "https://cdn.example/alice.png"}, event.Actor)
	assert.Equal(t, "今天写了点代码", event.ObjectTitle)
	assert.Equal(t, "转发 说两句", event.Quote)
	assert.Equal(t, toDTO(viaDB(t, store.saved[0])).Structured, event.Structured)

	// 断线补发走 NewSSEEvent(读回的实体)，字段同样一致
	assert.Equal(t, event.Structured, NewSSEEvent(viaDB(t, store.saved[0])).Structured)

	raw, err := json.Marshal(event)
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"actor":{"name":"Alice","avatar_url":"https://cdn.example/alice.png"}`)
	assert.Contains(t, string(raw), `"object_title":"今天写了点代码"`)
	assert.Contains(t, string(raw), `"quote":"转发 说两句"`)
	assert.Contains(t, string(raw), `"payload":`, "payload 仍然输出")
}
