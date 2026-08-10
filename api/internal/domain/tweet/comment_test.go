package tweet

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestNewComment_Valid(t *testing.T) {
	tweetID := shared.NewID()
	authorID := shared.NewID()

	c, err := NewComment(tweetID, authorID, "  hello  ")
	require.NoError(t, err)
	assert.Equal(t, tweetID, c.TweetID())
	assert.Equal(t, authorID, c.AuthorID())
	assert.Equal(t, "hello", c.Body(), "正文应 trim 后存储")
	assert.Equal(t, int16(0), c.Depth())
	assert.False(t, c.CreatedAt().IsZero())
}

func TestNewComment_EmptyBody(t *testing.T) {
	cases := []string{"", "   ", "\n\t "}
	for _, body := range cases {
		_, err := NewComment(shared.NewID(), shared.NewID(), body)
		assert.Error(t, err, "纯空白正文应拒绝: %q", body)
	}
}

func TestNewComment_BodyTooLong(t *testing.T) {
	body := strings.Repeat("字", MaxCommentBodyLen+1)
	_, err := NewComment(shared.NewID(), shared.NewID(), body)
	assert.Error(t, err)

	// 恰好上限通过
	body = strings.Repeat("字", MaxCommentBodyLen)
	_, err = NewComment(shared.NewID(), shared.NewID(), body)
	assert.NoError(t, err)
}

func TestComment_SetParent_TopLevel(t *testing.T) {
	c, err := NewComment(shared.NewID(), shared.NewID(), "顶层")
	require.NoError(t, err)
	require.NoError(t, c.SetParent(nil))

	assert.Equal(t, int16(0), c.Depth())
	assert.Nil(t, c.ParentID())
	assert.Equal(t, c.ID().String()+"/", c.Path())
}

func TestComment_SetParent_ReplyToTopLevel(t *testing.T) {
	top, err := NewComment(shared.NewID(), shared.NewID(), "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))

	reply, err := NewComment(shared.NewID(), shared.NewID(), "回复")
	require.NoError(t, err)
	require.NoError(t, reply.SetParent(top))

	assert.Equal(t, int16(1), reply.Depth())
	require.NotNil(t, reply.ParentID())
	assert.Equal(t, top.ID(), *reply.ParentID())
	// 回复 path 挂在顶层祖先下
	assert.Equal(t, top.ID().String()+"/"+reply.ID().String()+"/", reply.Path())
}

func TestComment_SetParent_ReplyToReply(t *testing.T) {
	// 两层扁平：回复一条回复，depth 仍为 1，path 挂同一顶层祖先
	top, err := NewComment(shared.NewID(), shared.NewID(), "顶层")
	require.NoError(t, err)
	require.NoError(t, top.SetParent(nil))

	r1, err := NewComment(shared.NewID(), shared.NewID(), "回复1")
	require.NoError(t, err)
	require.NoError(t, r1.SetParent(top))

	r2, err := NewComment(shared.NewID(), shared.NewID(), "回复2 回复 r1")
	require.NoError(t, err)
	require.NoError(t, r2.SetParent(r1))

	// 回复回复仍是 depth=1（两层扁平）
	assert.Equal(t, int16(1), r2.Depth())
	require.NotNil(t, r2.ParentID())
	assert.Equal(t, r1.ID(), *r2.ParentID(), "parent_id 指被回复者 r1")
	// path 仍挂在顶层祖先 top 下
	assert.Equal(t, top.ID().String()+"/"+r2.ID().String()+"/", r2.Path())
}

func TestReconstructComment(t *testing.T) {
	id := shared.NewID()
	tweetID := shared.NewID()
	authorID := shared.NewID()
	parentID := shared.NewID()
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	c := ReconstructComment(id, tweetID, authorID, "body", &parentID, 1, "aaa/bbb/", created, created)
	assert.Equal(t, id, c.ID())
	assert.Equal(t, tweetID, c.TweetID())
	assert.Equal(t, authorID, c.AuthorID())
	assert.Equal(t, "body", c.Body())
	require.NotNil(t, c.ParentID())
	assert.Equal(t, parentID, *c.ParentID())
	assert.Equal(t, int16(1), c.Depth())
	assert.Equal(t, "aaa/bbb/", c.Path())
}
