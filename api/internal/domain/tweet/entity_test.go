package tweet

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestNewTweet_Valid(t *testing.T) {
	authorID := shared.NewID()

	t.Run("纯文本", func(t *testing.T) {
		tw, err := NewTweet(authorID, "今天天气不错", nil, nil)
		require.NoError(t, err)
		assert.Equal(t, authorID, tw.AuthorID())
		assert.Equal(t, "今天天气不错", tw.Content())
		assert.Equal(t, []string{}, tw.Images(), "默认 images 应空切片非 nil")
		assert.Nil(t, tw.QuoteOf())
		assert.Equal(t, 0, tw.LikeCount())
		assert.False(t, tw.ID().IsZero())
		assert.False(t, tw.CreatedAt().IsZero())
	})

	t.Run("纯图片", func(t *testing.T) {
		tw, err := NewTweet(authorID, "", []string{"/uploads/tweet/a.webp"}, nil)
		require.NoError(t, err)
		assert.Equal(t, "", tw.Content())
		assert.Len(t, tw.Images(), 1)
		assert.Nil(t, tw.QuoteOf())
	})

	t.Run("纯引用转发（无文字无图片）", func(t *testing.T) {
		quotedID := shared.NewID()
		tw, err := NewTweet(authorID, "", nil, &quotedID)
		require.NoError(t, err)
		assert.Equal(t, "", tw.Content())
		assert.Empty(t, tw.Images())
		require.NotNil(t, tw.QuoteOf())
		assert.Equal(t, quotedID, *tw.QuoteOf())
	})

	t.Run("正文 trim 后存储", func(t *testing.T) {
		tw, err := NewTweet(authorID, "  你好  ", nil, nil)
		require.NoError(t, err)
		assert.Equal(t, "你好", tw.Content())
	})
}

func TestNewTweet_ContentBoundary(t *testing.T) {
	authorID := shared.NewID()

	cases := []struct {
		name    string
		content string
		wantErr bool
	}{
		{"500 个 ASCII 字符", strings.Repeat("a", 500), false},
		{"501 个 ASCII 字符", strings.Repeat("a", 501), true},
		{"500 个汉字（rune 计非字节）", strings.Repeat("推", 500), false},
		{"501 个汉字", strings.Repeat("推", 501), true},
		{"前后空白不计入 trim 后长度", " " + strings.Repeat("a", 500) + " ", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := NewTweet(authorID, c.content, nil, nil)
			if c.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestNewTweet_ImageBoundary(t *testing.T) {
	authorID := shared.NewID()

	t.Run("4 张图通过", func(t *testing.T) {
		imgs := []string{"/u/1.webp", "/u/2.webp", "/u/3.webp", "/u/4.webp"}
		tw, err := NewTweet(authorID, "", imgs, nil)
		require.NoError(t, err)
		assert.Len(t, tw.Images(), 4)
	})

	t.Run("5 张图拒绝", func(t *testing.T) {
		imgs := []string{"/u/1.webp", "/u/2.webp", "/u/3.webp", "/u/4.webp", "/u/5.webp"}
		_, err := NewTweet(authorID, "", imgs, nil)
		require.Error(t, err)
	})

	t.Run("空 URL 元素拒绝", func(t *testing.T) {
		_, err := NewTweet(authorID, "", []string{"  "}, nil)
		require.Error(t, err)
	})
}

func TestNewTweet_EmptyContentAndImages(t *testing.T) {
	authorID := shared.NewID()

	cases := []struct {
		name    string
		content string
		images  []string
	}{
		{"空内容 + nil 图片", "", nil},
		{"空内容 + 空图片切片", "", []string{}},
		{"纯空白内容 trim 后视同空", "  \n\t ", nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := NewTweet(authorID, c.content, c.images, nil)
			require.Error(t, err)
		})
	}
}

func TestNewTweet_RecordsCreatedEvent(t *testing.T) {
	tw, err := NewTweet(shared.NewID(), "事件测试", nil, nil)
	require.NoError(t, err)

	require.True(t, tw.HasEvents())
	events := tw.PullEvents()
	require.Len(t, events, 1)
	created, ok := events[0].(TweetCreated)
	require.True(t, ok, "事件类型应为 TweetCreated")
	assert.Equal(t, "tweet.created", created.EventName())
	assert.Equal(t, tw.ID(), created.AggregateID())
	assert.Equal(t, tw.AuthorID(), created.AuthorID)
	assert.Equal(t, "事件测试", created.Excerpt)
}

func TestNewTweetCreated_ExcerptTruncation(t *testing.T) {
	// 长正文截断到 50 rune + 省略号（审计快照非全文）
	tw, err := NewTweet(shared.NewID(), strings.Repeat("长", 60), nil, nil)
	require.NoError(t, err)
	events := tw.PullEvents()
	require.Len(t, events, 1)
	excerpt := events[0].(TweetCreated).Excerpt
	assert.Equal(t, strings.Repeat("长", 50)+"…", excerpt)
}

func TestReconstructTweet(t *testing.T) {
	id := shared.NewID()
	authorID := shared.NewID()
	images := []string{"/u/a.webp"}
	now := time.Now()
	quoteID := shared.NewID()
	tw := ReconstructTweet(id, authorID, "重建", images, &quoteID, 7, now, now)

	assert.Equal(t, id, tw.ID())
	assert.Equal(t, authorID, tw.AuthorID())
	assert.Equal(t, "重建", tw.Content())
	assert.Equal(t, images, tw.Images())
	assert.Equal(t, 7, tw.LikeCount())
	assert.False(t, tw.HasEvents(), "重建不应携带待发布事件")
}

func TestNewTweetDeleted(t *testing.T) {
	tw, err := NewTweet(shared.NewID(), "将被删除", nil, nil)
	require.NoError(t, err)
	e := NewTweetDeleted(tw)
	assert.Equal(t, "tweet.deleted", e.EventName())
	assert.Equal(t, tw.ID(), e.AggregateID())
	assert.Equal(t, tw.AuthorID(), e.AuthorID)
	assert.Equal(t, "将被删除", e.Excerpt)
}
func TestExtractHashtags(t *testing.T) {
	cases := []struct {
		name     string
		content  string
		expected []string
	}{
		{
			name:     "无话题",
			content:  "今天天气真不错",
			expected: []string{},
		},
		{
			name:     "单个话题规范化为小写",
			content:  "发布一条 #Golang# 动态",
			expected: []string{"golang"},
		},
		{
			name:     "多个话题去重与顺序",
			content:  "#Go# 和 #Python#，重试 #go# 话题",
			expected: []string{"go", "python"},
		},
		{
			name:     "包含空格与标点的话题",
			content:  "#Hello World# #编程_开发#",
			expected: []string{"hello world", "编程_开发"},
		},
		{
			name:     "未闭合的话题忽略",
			content:  "#未闭合 的标签",
			expected: []string{},
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := ExtractHashtags(c.content)
			assert.Equal(t, c.expected, got)
		})
	}
}
