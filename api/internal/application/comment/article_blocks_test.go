package comment

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/comment"
)

func TestExtractArticleBlocks_MatchesNewAnchorNodeMatrix(t *testing.T) {
	html := `<div data-article-content>
		<p>hello <code>world</code> <a href="/post">link</a></p>
		<h1>一级</h1><h2>二级</h2><h3>三级</h3><h4>四级</h4><h5>五级</h5><h6>六级</h6>
		<ul><li>列表项</li></ul><blockquote><p>引用段落</p></blockquote>
		<details><summary>摘要</summary><p>折叠正文</p></details>
		<table><tr><th>表头</th><td>单元格</td></tr></table>
		<p><img src="/image.png" alt="图片说明"></p>
		<figure><img src="/figure.png"><figcaption>图注</figcaption></figure>
		<div data-type="block-math" data-latex="x^2"></div>
		<div data-type="diagram-block" data-source="graph TD"></div>
		<pre><code>代码</code></pre>
		<pre data-runnable="true" data-source="print(1)"><code>print(1)</code></pre>
		<pre><code class="language-dialogue">{"text":"嵌入"}</code></pre>
		<p>   </p>
	</div>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	texts := make([]string, len(blocks))
	for i, block := range blocks {
		texts[i] = block.Text
	}
	// 引用块与其内唯一段落文本相同，各算一个候选（阅读端悬停会提升到外层）
	assert.Equal(t, []string{"hello world link", "一级", "二级", "三级", "四级", "五级", "六级", "列表项", "引用段落", "引用段落", "折叠正文"}, texts)
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

func TestEnsureAnchorMatchesArticle_RejectsRunnableSource(t *testing.T) {
	html := `<pre data-runnable="true" data-lang="python" data-source="print(1)"><code class="hljs">print(<span>1</span>)</code></pre>`
	anchor, err := BuildFullBlockAnchor("print(1)")
	require.NoError(t, err)
	require.Error(t, EnsureAnchorMatchesArticle(html, anchor))
}

func TestEnsureAnchorMatchesArticle_AcceptsMathNormalizedBlock(t *testing.T) {
	html := `<p>见 <span data-type="inline-math" data-latex="x^2"></span></p>`
	blockText := "见 x^2"
	a, err := ResolveAnnotationAnchor("", 0, 1, "见", "", blockText)
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle(html, a))
}

func TestEnsureAnchorMatchesArticle_RejectsUnsupportedBlocks(t *testing.T) {
	for _, tc := range []struct{ name, html, text string }{
		{"table", "<table><tr><th>标题</th><td>单元格</td></tr></table>", "单元格"},
		{"imageOnly", `<p><img alt="图片"></p>`, "图片"},
		{"figure", "<figure><figcaption><p>图注</p></figcaption></figure>", "图注"},
		{"blockMath", `<div data-type="block-math" data-latex="x^2"></div>`, "x^2"},
		{"diagram", `<div data-type="diagram-block" data-source="flow"></div>`, "flow"},
		{"code", "<pre><code>hello</code></pre>", "hello"},
		{"embed", `<pre><code class="language-dialogue">{"text":"hi"}</code></pre>`, `{"text":"hi"}`},
		{"summary", "<details><summary><p>摘要</p></summary></details>", "摘要"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			anchor, err := BuildFullBlockAnchor(tc.text)
			require.NoError(t, err)
			require.Error(t, EnsureAnchorMatchesArticle(tc.html, anchor))
		})
	}
}

func TestEnsureAnchorMatchesArticle_DoesNotConfuseUnsupportedBlockWithMatchingText(t *testing.T) {
	anchor, err := BuildFullBlockAnchor("same")
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle("<p>same</p><pre>same</pre>", anchor))
}

func TestEnsureAnchorMatchesArticle_AcceptsRepeatedBlockText(t *testing.T) {
	anchor, err := BuildFullBlockAnchor("same")
	require.NoError(t, err)
	require.NoError(t, EnsureAnchorMatchesArticle("<p>same</p><h2>same</h2>", anchor))
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

func TestExtractArticleBlocks_UnwrapsUnsupportedTagsLikeReader(t *testing.T) {
	html := `<p>ab<custom-tag>visible</custom-tag><style>.x{}</style>cd</p>`
	blocks, err := ExtractArticleBlocks(html)
	require.NoError(t, err)
	require.Len(t, blocks, 1)
	assert.Equal(t, "abvisible.x{}cd", blocks[0].Text)
}
