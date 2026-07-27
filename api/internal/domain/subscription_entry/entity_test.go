package subscription_entry

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"blog-api/internal/domain/shared"
)

func TestNewEntry_DefaultsToPending(t *testing.T) {
	subID := shared.NewID()
	now := time.Now()
	e := NewEntry(subID, "guid-1", "https://example.com/post", "标题", nil, now)

	assert.Equal(t, StatusPending, e.Status())
	assert.Equal(t, 0, e.FailCount())
	assert.Equal(t, "guid-1", e.GUID())
	assert.Equal(t, "https://example.com/post", e.EntryURL())
	assert.Nil(t, e.PostID())
}

func TestEntry_MarkImported(t *testing.T) {
	e := NewEntry(shared.NewID(), "g", "https://x", "t", nil, time.Now())
	postID := shared.NewID()
	e.MarkImported(postID)

	assert.Equal(t, StatusImported, e.Status())
	require := e.PostID()
	assert.NotNil(t, require)
	assert.Equal(t, postID, *require)
	assert.Empty(t, e.LastError(), "imported 应清错误")
}

func TestEntry_RecordFailure_DeadAfter3Times(t *testing.T) {
	e := NewEntry(shared.NewID(), "g", "https://x", "t", nil, time.Now())

	// 前 2 次：failed
	for i := 1; i < MaxFailCount; i++ {
		dead := e.RecordFailure("网络错误")
		assert.False(t, dead, "第 %d 次不应 dead", i)
		assert.Equal(t, StatusFailed, e.Status())
	}
	// 第 3 次：dead
	dead := e.RecordFailure("网络错误")
	assert.True(t, dead, "达上限应 dead")
	assert.Equal(t, StatusDead, e.Status())
	assert.Equal(t, MaxFailCount, e.FailCount())
	assert.Equal(t, "网络错误", e.LastError())
}

func TestEntry_IsProcessed(t *testing.T) {
	e := NewEntry(shared.NewID(), "g", "https://x", "t", nil, time.Now())
	assert.False(t, e.IsProcessed(), "pending 未处理")

	e.MarkImported(shared.NewID())
	assert.True(t, e.IsProcessed(), "imported 已处理")

	e2 := NewEntry(shared.NewID(), "g", "https://x", "t", nil, time.Now())
	for i := 0; i < MaxFailCount; i++ {
		e2.RecordFailure("err")
	}
	assert.True(t, e2.IsProcessed(), "dead 已处理（不再重试）")

	e3 := NewEntry(shared.NewID(), "g", "https://x", "t", nil, time.Now())
	e3.RecordFailure("err")
	assert.False(t, e3.IsProcessed(), "failed 未达上限仍可重试")
}
