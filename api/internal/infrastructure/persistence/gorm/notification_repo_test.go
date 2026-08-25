package gorm

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func setupNotificationDB(t *testing.T) *NotificationRepository {
	t.Helper()
	db := setupTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Notification{}))
	return NewNotificationRepository(db)
}

func mustNotification(t *testing.T) *domainnotification.Notification {
	t.Helper()
	n, err := domainnotification.NewNotification(
		domainshared.NewID(), domainshared.NewID(),
		domainnotification.SourceCommentApproved, domainshared.NewID(),
		"评论审核通过", "你的评论已审核通过", map[string]any{"post_title": "测试文章"},
	)
	require.NoError(t, err)
	return n
}

func TestNotificationRepository_SaveAndFind(t *testing.T) {
	repo := setupNotificationDB(t)
	n := mustNotification(t)

	require.NoError(t, repo.Save(context.Background(), n))

	got, err := repo.FindByID(context.Background(), n.GetID(), n.UserID())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, n.GetID(), got.GetID())
	assert.Equal(t, n.EventID(), got.EventID())
	assert.Equal(t, n.SourceType(), got.SourceType())
	assert.Equal(t, n.Title(), got.Title())
	assert.Equal(t, "测试文章", got.Payload()["post_title"])
	assert.False(t, got.CreatedAt().IsZero())
}

// TestNotificationRepository_Save_Idempotent 同一事件给同一接收者重复写只保留一行
//（N2 验收：同一 EventID 不重复写）。
func TestNotificationRepository_Save_Idempotent(t *testing.T) {
	repo := setupNotificationDB(t)

	eventID := domainshared.NewID()
	userID := domainshared.NewID()
	n1, err := domainnotification.NewNotification(
		userID, eventID, domainnotification.SourceFriendLinkApplied, domainshared.NewID(),
		"新友链申请", "收到新申请", nil,
	)
	require.NoError(t, err)
	n2, err := domainnotification.NewNotification(
		userID, eventID, domainnotification.SourceFriendLinkApplied, domainshared.NewID(),
		"新友链申请", "收到新申请", nil,
	)
	require.NoError(t, err)

	require.NoError(t, repo.Save(context.Background(), n1))
	require.NoError(t, repo.Save(context.Background(), n2))

	// 两个实体 ID 不同（各自生成），但 event+user 唯一键只放行第一行
	got1, err := repo.FindByID(context.Background(), n1.GetID(), userID)
	require.NoError(t, err)
	require.NotNil(t, got1)

	var count int64
	db := repo.db
	require.NoError(t, db.Model(&model.Notification{}).
		Where("event_id = ? AND user_id = ?", eventID.UUID(), userID.UUID()).
		Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestNotificationRepository_MarkAsRead(t *testing.T) {
	repo := setupNotificationDB(t)
	n := mustNotification(t)
	require.NoError(t, repo.Save(context.Background(), n))

	now := time.Now()
	require.NoError(t, repo.MarkAsRead(context.Background(), n.GetID(), n.UserID(), now))

	got, err := repo.FindByID(context.Background(), n.GetID(), n.UserID())
	require.NoError(t, err)
	assert.True(t, got.IsRead())
}

// TestNotificationRepository_MarkAsRead_WrongOwner 不能标记他人通知。
func TestNotificationRepository_MarkAsRead_WrongOwner(t *testing.T) {
	repo := setupNotificationDB(t)
	n := mustNotification(t)
	require.NoError(t, repo.Save(context.Background(), n))

	err := repo.MarkAsRead(context.Background(), n.GetID(), domainshared.NewID(), time.Now())
	assert.Error(t, err)
}

// 按来源批量已读只命中「同用户 + 同类型 + 同来源对象」的未读行。
func TestNotificationRepository_MarkUnreadBySourceAsRead(t *testing.T) {
	repo := setupNotificationDB(t)
	ctx := context.Background()
	userID := domainshared.NewID()
	convID := domainshared.NewID()

	mk := func(owner domainshared.ID, sourceType domainnotification.SourceType, sourceID domainshared.ID) *domainnotification.Notification {
		n, err := domainnotification.NewNotification(owner, domainshared.NewID(), sourceType, sourceID, "标题", "正文", nil)
		require.NoError(t, err)
		require.NoError(t, repo.Save(ctx, n))
		return n
	}
	target1 := mk(userID, domainnotification.SourceChatMessage, convID)
	target2 := mk(userID, domainnotification.SourceChatMessage, convID)
	otherConv := mk(userID, domainnotification.SourceChatMessage, domainshared.NewID())
	otherType := mk(userID, domainnotification.SourceCommentApproved, convID)
	otherUser := mk(domainshared.NewID(), domainnotification.SourceChatMessage, convID)

	require.NoError(t, repo.MarkUnreadBySourceAsRead(ctx, userID, domainnotification.SourceChatMessage, convID, time.Now()))

	for _, tc := range []struct {
		n    *domainnotification.Notification
		read bool
	}{
		{target1, true},
		{target2, true},
		{otherConv, false},
		{otherType, false},
		{otherUser, false},
	} {
		got, err := repo.FindByID(ctx, tc.n.GetID(), tc.n.UserID())
		require.NoError(t, err)
		assert.Equal(t, tc.read, got.IsRead(), "notification %s", tc.n.GetID())
	}
}
