package notification

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	domaincomment "blog-api/internal/domain/comment"
	domainfriendlink "blog-api/internal/domain/friendlink"
	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
	domainuser "blog-api/internal/domain/user"
)

// --- fakes ---

// fakeStoreCorrect 实现完整的 NotificationRepository 接口（只关心 Save）。
type fakeStoreCorrect struct {
	saved []*domainnotification.Notification
	err   error
}

func (f *fakeStoreCorrect) Save(_ context.Context, n *domainnotification.Notification) error {
	if f.err != nil {
		return f.err
	}
	f.saved = append(f.saved, n)
	return nil
}
func (f *fakeStoreCorrect) FindByID(context.Context, domainshared.ID, domainshared.ID) (*domainnotification.Notification, error) {
	return nil, nil
}
func (f *fakeStoreCorrect) FindNotify(context.Context, domainshared.ID, int, int) ([]*domainnotification.Notification, int64, error) {
	return nil, 0, nil
}
func (f *fakeStoreCorrect) CountUnread(context.Context, domainshared.ID) (int64, error) {
	return 0, nil
}
func (f *fakeStoreCorrect) MarkAsRead(context.Context, domainshared.ID, domainshared.ID, time.Time) error {
	return nil
}
func (f *fakeStoreCorrect) MarkAllAsRead(context.Context, domainshared.ID, time.Time) error {
	return nil
}
func (f *fakeStoreCorrect) FindAfterID(context.Context, domainshared.ID, domainshared.ID, int) ([]*domainnotification.Notification, error) {
	return nil, nil
}

type fakeSubLookup struct {
	ownerID domainshared.ID
	err     error
}

func (f *fakeSubLookup) FindOwnerID(context.Context, domainshared.ID) (domainshared.ID, error) {
	return f.ownerID, f.err
}

type fakeCommentLookup struct {
	authorID *domainshared.ID
	err      error
}

func (f *fakeCommentLookup) FindAuthorID(context.Context, domainshared.ID) (*domainshared.ID, error) {
	return f.authorID, f.err
}

type fakeAdminLookup struct {
	ids []domainshared.ID
	err error
}

func (f *fakeAdminLookup) FindAdminIDs(context.Context) ([]domainshared.ID, error) {
	return f.ids, f.err
}

type fakePostAuthorLookup struct {
	authorID *domainshared.ID
	err      error
}

func (f *fakePostAuthorLookup) FindPostAuthorID(context.Context, domainshared.ID) (*domainshared.ID, error) {
	return f.authorID, f.err
}

type fakeFriendlinkLookup struct {
	applicantID *domainshared.ID
	err         error
}

func (f *fakeFriendlinkLookup) FindApplicantID(context.Context, domainshared.ID) (*domainshared.ID, error) {
	return f.applicantID, f.err
}

// --- test helpers ---

func newTestSubscriber(store *fakeStoreCorrect, subLookup SubscriptionOwnerLookup, commentLookup CommentAuthorLookup, adminLookup AdminUserLookup, friendlinkLookup FriendLinkApplicantLookup, postAuthorLookup CommentPostAuthorLookup) *Subscriber {
	return NewSubscriber(store, subLookup, commentLookup, adminLookup, friendlinkLookup, postAuthorLookup, zerolog.Nop())
}

func newID() domainshared.ID { return domainshared.NewID() }

// --- tests ---

func TestSubscriber_SubscriptionFetched_Failure_WritesNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	subID := newID()
	ownerID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{ownerID: ownerID},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		subID, "rua.plus", false, 0, 1, "源站连接失败", "transient", true, false,
	))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)

	n := store.saved[0]
	assert.Equal(t, ownerID, n.UserID())
	assert.Equal(t, domainnotification.SourceSubscriptionFailed, n.SourceType())
	assert.Equal(t, subID, n.SourceID())
	assert.Contains(t, n.Title(), "rua.plus")
	assert.Contains(t, n.Title(), "抓取失败")
	assert.Equal(t, "源站连接失败", n.Body())
}

func TestSubscriber_SubscriptionFetched_Success_NoNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		newID(), "test", true, 5, 0, "", "", true, false,
	))
	require.NoError(t, err)
	assert.Empty(t, store.saved)
}

func TestSubscriber_SubscriptionFetched_ManualSuccess_WritesNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	ownerID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{ownerID: ownerID},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	// 手动触发（isSystem=false）+ 成功 → 应通知
	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		newID(), "rua.plus", true, 3, 0, "", "", false, false,
	))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceSubscriptionSucceeded, store.saved[0].SourceType())
	assert.Contains(t, store.saved[0].Title(), "抓取完成")
	assert.Contains(t, store.saved[0].Body(), "3 篇")
}

func TestSubscriber_FriendLinkCreated_NotifiesAdmins(t *testing.T) {
	store := &fakeStoreCorrect{}
	admin1, admin2 := newID(), newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{ids: []domainshared.ID{admin1, admin2}},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainfriendlink.NewFriendLinkCreated(
		newID(), "测试站", "https://example.com",
	))
	require.NoError(t, err)
	require.Len(t, store.saved, 2)
	assert.Equal(t, admin1, store.saved[0].UserID())
	assert.Equal(t, admin2, store.saved[1].UserID())
	assert.Equal(t, domainnotification.SourceFriendLinkApplied, store.saved[0].SourceType())
	assert.Contains(t, store.saved[0].Title(), "测试站")
}

func TestSubscriber_CommentApproved_NotifiesAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	commentID := newID()
	authorID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: &authorID},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentApproved(commentID))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, authorID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceCommentApproved, store.saved[0].SourceType())
	assert.Equal(t, commentID, store.saved[0].SourceID())
}

func TestSubscriber_CommentApproved_Anonymous_NoNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: nil},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentApproved(newID()))
	require.NoError(t, err)
	assert.Empty(t, store.saved)
}

func TestSubscriber_UnknownEvent_NoNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	// 用未映射的事件类型
	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionPaused(newID()))
	require.NoError(t, err)
	assert.Empty(t, store.saved)
}

func TestSubscriber_FriendLinkApproved_NotifiesApplicant(t *testing.T) {
	store := &fakeStoreCorrect{}
	applicantID := newID()
	linkID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{applicantID: &applicantID},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainfriendlink.NewFriendLinkApproved(linkID, "测试站", "pending"))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, applicantID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceFriendLinkReviewed, store.saved[0].SourceType())
	assert.Contains(t, store.saved[0].Title(), "已通过")
}

func TestSubscriber_FriendLinkRejected_NotifiesApplicant(t *testing.T) {
	store := &fakeStoreCorrect{}
	applicantID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{applicantID: &applicantID},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainfriendlink.NewFriendLinkRejected(newID(), "测试站", "pending"))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceFriendLinkReviewed, store.saved[0].SourceType())
	assert.Contains(t, store.saved[0].Title(), "未通过")
}

func TestSubscriber_FriendLinkReviewed_Anonymous_NoNotification(t *testing.T) {
	store := &fakeStoreCorrect{}
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{applicantID: nil},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainfriendlink.NewFriendLinkApproved(newID(), "测试站", "pending"))
	require.NoError(t, err)
	assert.Empty(t, store.saved)
}

func TestSubscriber_StoreError_FailSafeReturnsNil(t *testing.T) {
	store := &fakeStoreCorrect{err: errors.New("db down")}
	sub := newTestSubscriber(store,
		&fakeSubLookup{ownerID: newID()},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	// 写入失败应降级（fail-safe）：记日志后返回 nil，不阻断 EventBus
	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		newID(), "test", false, 0, 1, "err", "transient", true, false,
	))
	assert.NoError(t, err)
}

// fakeNotifier 记录 Push 调用，验证 PushingSubscriber 仅在 Save 成功时才推送。
type fakeNotifier struct {
	pushed []domainshared.ID
}

func (f *fakeNotifier) Push(id domainshared.ID, _ SSEEvent) { f.pushed = append(f.pushed, id) }

func TestPushingSubscriber_StoreError_FailSafeNoPush(t *testing.T) {
	store := &fakeStoreCorrect{err: errors.New("db down")}
	notif := &fakeNotifier{}
	sub := NewPushingSubscriber(store,
		&fakeSubLookup{ownerID: newID()},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{},
		notif,
		zerolog.Nop(),
	)

	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		newID(), "test", false, 0, 1, "err", "transient", true, false,
	))
	assert.NoError(t, err)
	assert.Empty(t, notif.pushed) // Save 失败不应推送
}

// --- 账号安全通知 ---

func TestSubscriber_PasswordChanged_NotifiesSelf(t *testing.T) {
	store := &fakeStoreCorrect{}
	userID := newID()
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	err := sub.Handle(context.Background(), domainuser.NewUserPasswordChanged(userID))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, userID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceAccountSecurity, store.saved[0].SourceType())
}

func TestSubscriber_PATCreated_NotifiesSelf(t *testing.T) {
	store := &fakeStoreCorrect{}
	userID := newID()
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	err := sub.Handle(context.Background(), domainapitoken.NewPATCreated(userID, "ci-deploy"))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, userID, store.saved[0].UserID())
	assert.Contains(t, store.saved[0].Title(), "ci-deploy")
}

func TestSubscriber_RoleChanged_NotifiesSelf(t *testing.T) {
	store := &fakeStoreCorrect{}
	userID := newID()
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	err := sub.Handle(context.Background(), domainuser.NewUserRoleChanged(userID, domainuser.RoleUser, domainuser.RoleAuthor, "rua"))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceAccountSecurity, store.saved[0].SourceType())
	assert.Contains(t, store.saved[0].Title(), "author")
}

func TestSubscriber_StatusDisabled_NotifiesSelf(t *testing.T) {
	store := &fakeStoreCorrect{}
	userID := newID()
	sub := newTestSubscriber(store, &fakeSubLookup{}, &fakeCommentLookup{}, &fakeAdminLookup{}, &fakeFriendlinkLookup{}, &fakePostAuthorLookup{})

	err := sub.Handle(context.Background(), domainuser.NewUserStatusChanged(userID, true, false, "rua"))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Contains(t, store.saved[0].Title(), "停用")
}

func TestSubscriber_UserRegistered_NotifiesAdmins(t *testing.T) {
	store := &fakeStoreCorrect{}
	adminID := newID()
	newUser := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{ids: []domainshared.ID{adminID}},
		&fakeFriendlinkLookup{},
			&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainuser.NewUserRegistered(newUser, mustEmail(t, "new@example.com")))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, adminID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceUserRegistered, store.saved[0].SourceType())
	assert.Equal(t, "new@example.com", store.saved[0].Body())
}

func mustEmail(t *testing.T, raw string) domainuser.Email {
	t.Helper()
	e, err := domainuser.ParseEmail(raw)
	require.NoError(t, err)
	return e
}

// --- 文章新评论通知（comment.approved 双接收者）---

func TestSubscriber_CommentApproved_NotifiesAuthorAndPostAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	commenterID := newID()
	postAuthorID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: &commenterID},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{authorID: &postAuthorID},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentApproved(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 2)
	assert.Equal(t, domainnotification.SourceCommentApproved, store.saved[0].SourceType())
	assert.Equal(t, commenterID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceCommentCreated, store.saved[1].SourceType())
	assert.Equal(t, postAuthorID, store.saved[1].UserID())
}

func TestSubscriber_CommentApproved_SelfComment_SkipsPostAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	sameID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: &sameID},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{authorID: &sameID},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentApproved(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceCommentApproved, store.saved[0].SourceType())
}

func TestSubscriber_CommentApproved_Anonymous_NotifiesPostAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	postAuthorID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: nil},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{authorID: &postAuthorID},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentApproved(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceCommentCreated, store.saved[0].SourceType())
	assert.Equal(t, postAuthorID, store.saved[0].UserID())
}

func TestSubscriber_CommentSpammed_NotifiesAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	authorID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: &authorID},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentSpammed(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceCommentRejected, store.saved[0].SourceType())
	assert.Equal(t, authorID, store.saved[0].UserID())
}

func TestSubscriber_SubscriptionFetched_AutoPaused_AppendsHint(t *testing.T) {
	store := &fakeStoreCorrect{}
	ownerID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{ownerID: ownerID},
		&fakeCommentLookup{},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domainsubscription.NewSubscriptionFetched(
		newID(), "rua.plus", false, 0, 1, "源站连接失败", "transient", true, true,
	))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Contains(t, store.saved[0].Body(), "自动暂停")
	assert.Contains(t, store.saved[0].Body(), "源站连接失败")
}

func TestSubscriber_CommentSubmitted_NotifiesAdmins(t *testing.T) {
	store := &fakeStoreCorrect{}
	adminID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{},
		&fakeAdminLookup{ids: []domainshared.ID{adminID}},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentSubmitted(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, adminID, store.saved[0].UserID())
	assert.Equal(t, domainnotification.SourceCommentPending, store.saved[0].SourceType())
}

func TestSubscriber_CommentAutoApproved_SkipsCommenterNotifiesPostAuthor(t *testing.T) {
	store := &fakeStoreCorrect{}
	commenterID := newID()
	postAuthorID := newID()
	sub := newTestSubscriber(store,
		&fakeSubLookup{},
		&fakeCommentLookup{authorID: &commenterID},
		&fakeAdminLookup{},
		&fakeFriendlinkLookup{},
		&fakePostAuthorLookup{authorID: &postAuthorID},
	)

	err := sub.Handle(context.Background(), domaincomment.NewCommentAutoApproved(newID()))
	require.NoError(t, err)
	require.Len(t, store.saved, 1)
	assert.Equal(t, domainnotification.SourceCommentCreated, store.saved[0].SourceType())
	assert.Equal(t, postAuthorID, store.saved[0].UserID())
}
