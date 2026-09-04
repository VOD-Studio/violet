package note

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func newID(t *testing.T) shared.ID {
	t.Helper()
	return shared.NewID()
}

func TestNewNote_Valid(t *testing.T) {
	author := newID(t)
	n, err := NewNote(newID(t), author, "  Redis 取整坑  ", "# 现象\n正文", []string{"redis", " redis ", "", "ops", "redis"})
	require.NoError(t, err)
	assert.Equal(t, StatusDraft, n.Status())
	assert.Equal(t, "Redis 取整坑", n.Title())
	assert.Equal(t, []string{"redis", "ops"}, n.Tags(), "标签应去空白、去空项并按原顺序去重")
	assert.Nil(t, n.PublishedAt())
}

func TestNewNote_EmptyTitleAllowed(t *testing.T) {
	n, err := NewNote(newID(t), newID(t), "", "正文", nil)
	require.NoError(t, err)
	assert.Equal(t, "", n.Title())
}

func TestNewNote_BlankContentRejected(t *testing.T) {
	_, err := NewNote(newID(t), newID(t), "标题", "   \n  ", nil)
	require.Error(t, err)
}

func TestNewNote_TitleTooLong(t *testing.T) {
	long := make([]rune, MaxTitleRunes+1)
	for i := range long {
		long[i] = '坑'
	}
	_, err := NewNote(newID(t), newID(t), string(long), "正文", nil)
	require.Error(t, err)
}

func TestNewNote_TooManyTags(t *testing.T) {
	tags := []string{"a", "b", "c", "d", "e", "f", "g", "h", "i"}
	_, err := NewNote(newID(t), newID(t), "", "正文", tags)
	require.Error(t, err, "去重后超过 8 个标签应拒绝")
}

func TestEdit_ReplacesContentWithoutTouchingState(t *testing.T) {
	n, err := NewNote(newID(t), newID(t), "旧标题", "旧正文", []string{"old"})
	require.NoError(t, err)
	published := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	n.Publish(published)

	require.NoError(t, n.Edit("新标题", "新正文", "<p>新正文</p>", []string{"new"}))
	assert.Equal(t, "新标题", n.Title())
	assert.Equal(t, "新正文", n.ContentMD())
	assert.Equal(t, "<p>新正文</p>", n.ContentHTML())
	assert.Equal(t, []string{"new"}, n.Tags())
	assert.Equal(t, StatusPublished, n.Status(), "编辑不改变状态")
	require.NotNil(t, n.PublishedAt())
	assert.Equal(t, published, *n.PublishedAt(), "编辑不刷新发布时间")
}

func TestEdit_BlankContentRejected(t *testing.T) {
	n, err := NewNote(newID(t), newID(t), "", "正文", nil)
	require.NoError(t, err)
	require.Error(t, n.Edit("", "  ", "", nil))
}

func TestPublish_FirstTimeStampsIdempotentKeepsOriginal(t *testing.T) {
	n, err := NewNote(newID(t), newID(t), "", "正文", nil)
	require.NoError(t, err)
	assert.False(t, n.IsPublished())

	first := time.Date(2026, 9, 2, 8, 0, 0, 0, time.UTC)
	n.Publish(first)
	require.NotNil(t, n.PublishedAt())
	assert.Equal(t, first, *n.PublishedAt())
	assert.True(t, n.IsPublished())

	n.Publish(first.Add(time.Hour))
	assert.Equal(t, first, *n.PublishedAt(), "重复发布不刷新时间")
}

func TestReconstruct_RoundTrip(t *testing.T) {
	id, author := newID(t), newID(t)
	published := time.Date(2026, 9, 2, 9, 0, 0, 0, time.UTC)
	n := Reconstruct(id, author, "标题", "md", "html", StatusPublished, &published, published, published, []string{"x"})
	assert.Equal(t, id, n.ID())
	assert.Equal(t, author, n.AuthorID())
	assert.Equal(t, StatusPublished, n.Status())
	assert.True(t, n.IsPublished())
}
