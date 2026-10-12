package comment

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/comment"
)

func TestExtractArticleBlocks_MatchesFrontendSelectors(t *testing.T) {
	html := `<div data-article-content>
		<p>hello world</p>
		<h2>标题</h2>
		<li>列表项</li>
		<pre>code</pre>
		<p>   </p>
	</div>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 4)
	id, err := ComputeBlockID("hello world")
	require.NoError(t, err)
	assert.Equal(t, id, blocks[0].ID)
	assert.Equal(t, "hello world", blocks[0].Text)
}

func TestEnsureAnchorMatchesArticle_RejectsSubstringBlockText(t *testing.T) {
	html := `<p>hello world</p>`
	// 子串 "hello" 的 hash 不是完整块 hash
	a, err := ResolveAnnotationAnchor("", 0, 5, "hello", "", "hello")
	require.NoError(t, err)
	err = EnsureAnchorMatchesArticle(html, a)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "未匹配文章中任何完整渲染块")
}

func TestEnsureAnchorMatchesArticle_AcceptsFullBlock(t *testing.T) {
	html := `<p>hello world</p>`
	a, err := ResolveAnnotationAnchor("", 0, 5, "hello", "", "hello world")
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle(html, a))
}

func TestEnsureAnchorMatchesArticle_FiveTupleWithoutBlockText(t *testing.T) {
	html := `<p>hello world</p>`
	id, err := ComputeBlockID("hello world")
	require.NoError(t, err)
	a := &domain.Anchor{
		BlockID: id, StartOffset: 6, EndOffset: 11,
		SelectedText: "world", BlockHashSync: id,
	}
	require.NoError(t, EnsureAnchorMatchesArticle(html, a))
}

func TestEnsureAnchorMatchesArticle_RejectsUnknownBlockID(t *testing.T) {
	html := `<p>hello world</p>`
	a := &domain.Anchor{
		BlockID: "deadbeef", StartOffset: 0, EndOffset: 5,
		SelectedText: "hello", BlockHashSync: "deadbeef",
	}
	err := EnsureAnchorMatchesArticle(html, a)
	assert.Error(t, err)
}
