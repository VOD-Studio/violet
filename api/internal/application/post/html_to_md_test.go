package post

import (
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	markdown "blog-api/internal/application/markdown"
)

// TestHTMLToMarkdown 验证 HTML→Markdown 转换的各语义节点正确性。
// 覆盖 issue #78 验收：纯文本、代码块、表格、链接、行内/块级数学公式。
func TestHTMLToMarkdown(t *testing.T) {
	t.Run("纯文本与段落", func(t *testing.T) {
		md, err := htmlToMarkdown("<p>你好</p><p>世界</p>")
		require.NoError(t, err)
		assert.Contains(t, md, "你好")
		assert.Contains(t, md, "世界")
	})

	t.Run("代码块保留语言标识", func(t *testing.T) {
		html := `<pre><code class="language-go">func main() {}</code></pre>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		assert.Contains(t, md, "```go", "代码块应带 language-go 围栏")
		assert.Contains(t, md, "func main() {}")
		assert.Contains(t, md, "```")
	})

	t.Run("表格转 GFM", func(t *testing.T) {
		html := `<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		assert.Contains(t, md, "|", "表格应转成 GFM 管道语法")
	})

	t.Run("行内公式转 dollar", func(t *testing.T) {
		html := `<p>公式 <span data-type="inline-math" data-latex="E=mc^2">E=mc²</span> 内联</p>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		assert.Contains(t, md, "$E=mc^2$", "行内公式占位应还原为 $...$")
		// 渲染 DOM 文本 E=mc² 不应残留（占位 span 整体被替换）
		assert.NotContains(t, md, "E=mc²")
	})

	t.Run("块级公式转 double-dollar", func(t *testing.T) {
		html := `<div data-type="block-math" data-latex="\int x\,dx">∫x dx</div>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		// 块级公式应还原为 $$...$$（库会对 _ 做 emphasis 转义，故用 \int 关键字 + $$ 包围断言）
		assert.Contains(t, md, "$$", "块级公式应有 $$ 包围")
		assert.Contains(t, md, `\int`, "LaTeX 命令应保留")
		assert.Contains(t, md, `\,dx`, "LaTeX 微分运算符应保留")
	})

	t.Run("链接转 markdown 链接", func(t *testing.T) {
		html := `<p>见 <a href="https://example.com">示例</a></p>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		assert.Contains(t, md, "[示例](https://example.com)")
	})

	t.Run("列表转 markdown", func(t *testing.T) {
		html := `<ul><li>一</li><li>二</li></ul>`
		md, err := htmlToMarkdown(html)
		require.NoError(t, err)
		assert.True(t, strings.Contains(md, "- 一") || strings.Contains(md, "* 一"))
	})
}

func TestHTMLToMarkdown_CarrierRoundTrip(t *testing.T) {
	source := "$x_1$ and $y_2$.\n\n$$\nx_1 + y_2\n$$\n\n~~~~mermaid\ngraph TD\nA --> B\n~~~~\n\n```js runnable {\"timeout_secs\": 10}\nconsole.log('$x$')\n```\n\nFirst[^note], again[^note].\n\n[^note]: One **bold** paragraph.\n\n    Another paragraph.\n\n- [x] Checked\n\n==highlight=="
	html, err := markdown.ToHTML(source)
	require.NoError(t, err)
	converted, err := htmlToMarkdown(html)
	require.NoError(t, err)
	for _, expected := range []string{
		"$x_1$", "$y_2$", "x_1 + y_2", "```mermaid", "A --> B",
		"node runnable", `"timeout_secs":10`, "console.log('$x$')",
		"[^1]", "[^1]:", "Another paragraph.", "[x] Checked", "==highlight==",
	} {
		assert.Contains(t, converted, expected)
	}
	assert.Equal(t, 3, strings.Count(converted, "[^1]"))
	roundTrip, err := markdown.ToHTML(converted)
	require.NoError(t, err)
	for _, expected := range []string{
		`data-latex="x_1"`, `data-latex="y_2"`, `data-type="block-math"`,
		`data-format="mermaid"`, `data-runnable="true"`, `data-checked="true"`,
		`id="fnref1:1"`, "<mark>highlight</mark>",
	} {
		assert.Contains(t, roundTrip, expected)
	}
}

func TestHTMLToMarkdown_FootnoteShapes(t *testing.T) {
	for name, html := range map[string]string{
		"remark": `<p>A<sup><a href="#user-content-fn-note" data-footnote-ref="">1</a></sup> B<sup><a href="#user-content-fn-note" data-footnote-ref="">1</a></sup></p><section data-footnotes=""><h2>Footnotes</h2><ol><li id="user-content-fn-note"><p>First</p><p>Second <a href="#ref" data-footnote-backref="">↩</a></p></li></ol></section>`,
		"editor": `<p>A<sup><a href="#fn-note" data-footnote-ref="" data-footnote-label="note">1</a></sup></p><section data-footnotes="" role="doc-endnotes"><ol><li id="fn-note" data-footnote-label="note"><div><p>First</p><p>Second</p></div><a href="#ref" role="doc-backlink">↩</a></li></ol></section>`,
	} {
		t.Run(name, func(t *testing.T) {
			md, err := htmlToMarkdown(html)
			require.NoError(t, err)
			assert.Contains(t, md, "A[^1]")
			roundTrip, err := markdown.ToHTML(md)
			require.NoError(t, err)
			doc, err := goquery.NewDocumentFromReader(strings.NewReader(roundTrip))
			require.NoError(t, err)
			definition := doc.Find(".footnotes li").First()
			definition.Find(`a[role="doc-backlink"]`).Remove()
			paragraphs := definition.Find("p").Map(func(_ int, p *goquery.Selection) string {
				return strings.TrimSpace(p.Text())
			})
			assert.Equal(t, []string{"First", "Second"}, paragraphs)
			assert.NotContains(t, md, "Footnotes")
			assert.NotContains(t, md, "↩")
		})
	}
}

func TestHTMLToMarkdown_CodeContainingFence(t *testing.T) {
	source := "<pre data-runnable=\"true\" data-lang=\"python\"><code>print('```')</code></pre>"
	md, err := htmlToMarkdown(source)
	require.NoError(t, err)
	assert.Contains(t, md, "````python runnable")
	assert.Contains(t, md, "print('```')")
}

func TestHTMLToMarkdown_PreservesTableAttributes(t *testing.T) {
	html := `<table><tr><td colspan="2" rowspan="3" data-colwidth="120,120">cell</td></tr></table>`
	converted, err := htmlToMarkdown(html)
	require.NoError(t, err)
	for _, attribute := range []string{`colspan="2"`, `rowspan="3"`, `data-colwidth="120,120"`} {
		assert.Contains(t, converted, attribute)
	}
	roundTrip, err := markdown.ToHTML(converted)
	require.NoError(t, err)
	assert.Contains(t, roundTrip, `colspan="2" rowspan="3" data-colwidth="120,120"`)
}
