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

func TestExtractArticleBlocks_InlineMathUsesDataLatex(t *testing.T) {
	html := `<p>质能方程 <span data-type="inline-math" data-latex="E=mc^2"></span> 成立</p>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	assert.Equal(t, "质能方程 E=mc^2 成立", blocks[0].Text)
	id, err := ComputeBlockID("质能方程 E=mc^2 成立")
	require.NoError(t, err)
	assert.Equal(t, id, blocks[0].ID)
}

func TestExtractArticleBlocks_RunnablePreUsesDataSource(t *testing.T) {
	html := `<pre data-runnable="true" data-lang="python" data-source="print(1)"><code class="hljs">print(<span>1</span>)</code></pre>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	assert.Equal(t, "print(1)", blocks[0].Text)
}

func TestEnsureAnchorMatchesArticle_AcceptsMathNormalizedBlock(t *testing.T) {
	html := `<p>见 <span data-type="inline-math" data-latex="x^2"></span></p>`
	blockText := "见 x^2"
	a, err := ResolveAnnotationAnchor("", 0, 1, "见", "", blockText)
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle(html, a))
}

func TestResolveArticleHTML_PrefersHTML(t *testing.T) {
	got := ResolveArticleHTML("<p>from html</p>", "# md")
	assert.Equal(t, "<p>from html</p>", got)
}

func TestResolveArticleHTML_FallsBackToMarkdown(t *testing.T) {
	got := ResolveArticleHTML("", "质能方程 $E=mc^2$ 成立")
	require.NotEmpty(t, got)
	assert.Contains(t, got, "质能方程")
	assert.Contains(t, got, `data-type="inline-math"`)
	blocks, err := ExtractArticleBlocks(got)
	require.NoError(t, err)
	require.NotEmpty(t, blocks)
}

func TestEnsureAnchorMatchesArticle_MarkdownFallbackBody(t *testing.T) {
	html := ResolveArticleHTML("", "hello world")
	require.NotEmpty(t, html)
	a, err := ResolveAnnotationAnchor("", 0, 5, "hello", "", "hello world")
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle(html, a))
}

func TestExtractArticleBlocks_SkipsSanitizedAwayScriptText(t *testing.T) {
	html := `<p>Hello<script>secret</script>world</p>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	assert.Equal(t, "Helloworld", blocks[0].Text)

	visible, err := ResolveAnnotationAnchor("", 0, 10, "Helloworld", "", "Helloworld")
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle(html, visible))

	rawSecret, err := ResolveAnnotationAnchor("", 0, 16, "Hellosecretworld", "", "Hellosecretworld")
	require.NoError(t, err)
	err = EnsureAnchorMatchesArticle(html, rawSecret)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "未匹配文章中任何完整渲染块")
}

func TestExtractArticleBlocks_SkipsStyleSubtree(t *testing.T) {
	html := `<p>ab<style>.x{}</style>cd</p>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	assert.Equal(t, "abcd", blocks[0].Text)
}
