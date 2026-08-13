package notification

import (
	"testing"
	"time"

	domainshared "blog-api/internal/domain/shared"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newID() domainshared.ID { return domainshared.NewID() }

func TestNewNotification_Valid(t *testing.T) {
	uid, sid := newID(), newID()
	n, err := NewNotification(uid, SourceCommentApproved, sid, "评论审核通过", "你的评论已审核通过", map[string]any{"post_title": "测试文章"})

	require.NoError(t, err)
	assert.Equal(t, uid, n.UserID())
	assert.Equal(t, SourceCommentApproved, n.SourceType())
	assert.Equal(t, sid, n.SourceID())
	assert.Equal(t, "评论审核通过", n.Title())
	assert.False(t, n.IsRead())
	assert.Nil(t, n.ReadAt())
}

func TestNewNotification_InvalidSourceType(t *testing.T) {
	_, err := NewNotification(newID(), SourceType("bogus"), newID(), "标题", "", nil)
	assert.ErrorIs(t, err, ErrInvalidSourceType)
}

func TestNewNotification_EmptyUserID(t *testing.T) {
	_, err := NewNotification(domainshared.ID{}, SourceCommentApproved, newID(), "标题", "", nil)
	assert.Error(t, err)
}

func TestNewNotification_EmptySourceID(t *testing.T) {
	_, err := NewNotification(newID(), SourceCommentApproved, domainshared.ID{}, "标题", "", nil)
	assert.Error(t, err)
}

func TestNewNotification_EmptyTitle(t *testing.T) {
	_, err := NewNotification(newID(), SourceCommentApproved, newID(), "", "", nil)
	assert.Error(t, err)
}

func TestMarkAsRead(t *testing.T) {
	n := mustNew(t)
	require.False(t, n.IsRead())

	now := time.Now()
	require.NoError(t, n.MarkAsRead(now))
	assert.True(t, n.IsRead())
	require.NotNil(t, n.ReadAt())
	assert.Equal(t, now, *n.ReadAt())
}

func TestMarkAsRead_AlreadyRead_CannotRevert(t *testing.T) {
	n := mustNew(t)
	now := time.Now()

	require.NoError(t, n.MarkAsRead(now))
	err := n.MarkAsRead(now.Add(time.Hour))
	assert.ErrorIs(t, err, ErrAlreadyRead)
}

func TestReconstruct(t *testing.T) {
	id, uid, sid := newID(), newID(), newID()
	readAt := time.Now()
	created := time.Now().Add(-time.Hour)

	n := Reconstruct(id, uid, SourceFriendLinkApplied, sid, "新友链申请", "收到新申请",
		map[string]any{"name": "测试站"}, &readAt, created)

	assert.Equal(t, id, n.GetID())
	assert.Equal(t, uid, n.UserID())
	assert.Equal(t, SourceFriendLinkApplied, n.SourceType())
	assert.Equal(t, sid, n.SourceID())
	assert.True(t, n.IsRead())
	assert.Equal(t, created, n.CreatedAt())
	assert.Equal(t, "测试站", n.Payload()["name"])
}

func TestIsValidSourceType(t *testing.T) {
	assert.True(t, IsValidSourceType(SourceSubscriptionFailed))
	assert.True(t, IsValidSourceType(SourceFriendLinkApplied))
	assert.True(t, IsValidSourceType(SourceCommentApproved))
	assert.False(t, IsValidSourceType(SourceType("random")))
}

func mustNew(t *testing.T) *Notification {
	t.Helper()
	n, err := NewNotification(newID(), SourceCommentApproved, newID(), "标题", "正文", nil)
	require.NoError(t, err)
	return n
}
