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

func TestHTMLToMarkdown_AlertRoundTrip(t *testing.T) {
	for _, kind := range []string{"NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"} {
		t.Run(kind, func(t *testing.T) {
			source := "> [!" + kind + "]\n> First **paragraph**.\n>\n> Second paragraph.\n>\n> - One\n> - Two\n>\n> ```text\n> [!NOTE]\n> ```"
			html, err := markdown.ToHTML(source)
			require.NoError(t, err)
			converted, err := htmlToMarkdown(html)
			require.NoError(t, err)
			assert.Contains(t, converted, "> [!"+kind+"]")
			assert.Contains(t, converted, "> Second paragraph.")
			assert.Contains(t, converted, "> ```text\n> [!NOTE]\n> ```")
			roundTrip, err := markdown.ToHTML(converted)
			require.NoError(t, err)
			doc, err := goquery.NewDocumentFromReader(strings.NewReader(roundTrip))
			require.NoError(t, err)
			alert := doc.Find(`blockquote[data-type="alert"]`)
			assert.Equal(t, 1, alert.Length())
			assert.Equal(t, kind, alert.AttrOr("data-alert-type", ""))
			assert.Equal(t, 2, alert.ChildrenFiltered("p").Length())
			assert.Equal(t, 2, alert.Find("li").Length())
			assert.Equal(t, "[!NOTE]\n", alert.Find("pre code").Text())
		})
	}
}

func TestHTMLToMarkdown_OrdinaryQuotesStayOrdinary(t *testing.T) {
	for _, source := range []string{
		"> \\[!NOTE]\n> Literal marker",
		"> [!UNKNOWN]\n> Unknown marker",
		"> `[!NOTE]`\n> Code marker",
		"> Intro\n>\n> [!NOTE]\n> Later marker",
	} {
		html, err := markdown.ToHTML(source)
		require.NoError(t, err)
		converted, err := htmlToMarkdown(html)
		require.NoError(t, err)
		roundTrip, err := markdown.ToHTML(converted)
		require.NoError(t, err)
		assert.NotContains(t, roundTrip, `data-type="alert"`)
		assert.Contains(t, roundTrip, "<blockquote>")
	}
	converted, err := htmlToMarkdown(`<blockquote data-type="alert" data-alert-type="UNKNOWN"><p>Body</p></blockquote>`)
	require.NoError(t, err)
	assert.Equal(t, "> Body", converted)
}

func TestHTMLToMarkdown_NativeInlineAndFootnotes(t *testing.T) {
	source := `<p>H<sub><strong>2</strong></sub>O x<sup>2</sup> literal<sup>[^literal]</sup> A<sup><a href="#fn-note" data-footnote-ref="">1</a></sup></p><section data-footnotes=""><ol><li id="fn-note"><p>Definition</p></li></ol></section>`
	converted, err := htmlToMarkdown(source)
	require.NoError(t, err)
	for _, expected := range []string{"<sub><strong>2</strong></sub>", "<sup>2</sup>", "<sup>&#91;^literal&#93;</sup>", "A[^1]", "[^1]: Definition"} {
		assert.Contains(t, converted, expected)
	}
	roundTrip, err := markdown.ToHTML(converted)
	require.NoError(t, err)
	assert.Contains(t, roundTrip, "<sub><strong>2</strong></sub>")
	assert.Contains(t, roundTrip, "<sup>2</sup>")
	assert.Contains(t, roundTrip, "<sup>[^literal]</sup>")
	assert.Contains(t, roundTrip, `href="#fn:1"`)
}

func TestHTMLToMarkdown_NativeInlineLiteralPunctuation(t *testing.T) {
	source := `<p><sub>*literal* _text_</sub> <sup><strong>bold</strong> [!NOTE] $x$ ==plain==</sup></p>`
	converted, err := htmlToMarkdown(source)
	require.NoError(t, err)
	roundTrip, err := markdown.ToHTML(converted)
	require.NoError(t, err)
	assert.Contains(t, roundTrip, "<sub>*literal* _text_</sub>")
	assert.Contains(t, roundTrip, "<sup><strong>bold</strong> [!NOTE] $x$ ==plain==</sup>")
	assert.NotContains(t, roundTrip, "<em>")
	assert.NotContains(t, roundTrip, "<mark>")
	assert.NotContains(t, roundTrip, `data-type="inline-math"`)
}

func TestHTMLToMarkdown_DetailsStayCompleteHTML(t *testing.T) {
	for name, source := range map[string]string{
		"canonical open": `<details open><summary>Read <strong>more</strong></summary><div data-type="detailsContent"><p>First H<sub>2</sub>O</p><p>Second x<sup>2</sup></p><ul><li>One</li><li>Two</li></ul><pre><code class="language-html">&lt;div&gt;

&lt;/div&gt;</code></pre><details><summary>Nested</summary><p>Inner</p></details></div></details>`,
		"native closed": `<details><summary>Read more</summary><p>First</p><p>Second</p><ul><li>One</li></ul></details>`,
	} {
		t.Run(name, func(t *testing.T) {
			converted, err := htmlToMarkdown(source)
			require.NoError(t, err)
			assert.Contains(t, converted, "<summary>")
			assert.Contains(t, converted, "<p>First")
			assert.Contains(t, converted, "<ul><li>One</li>")
			assert.NotContains(t, converted, "```")
			roundTrip, err := markdown.ToHTML(converted)
			require.NoError(t, err)
			before, err := goquery.NewDocumentFromReader(strings.NewReader(source))
			require.NoError(t, err)
			after, err := goquery.NewDocumentFromReader(strings.NewReader(roundTrip))
			require.NoError(t, err)
			expected, err := goquery.OuterHtml(before.Find("details").First())
			require.NoError(t, err)
			actual, err := goquery.OuterHtml(after.Find("details").First())
			require.NoError(t, err)
			assert.Equal(t, expected, actual)
		})
	}
}

func TestHTMLToMarkdown_FootnotesInsideHTMLCarriers(t *testing.T) {
	for name, carrier := range map[string]string{
		"details": `<details open><summary>More</summary><p>Inside<sup><a id="ref-a" href="#fn-a" role="doc-noteref">1</a></sup></p><pre><code>first` + "\n\n" + `**literal**</code></pre></details>`,
		"table":   `<table><tr><td colspan="2"><p>Inside<sup><a id="ref-a" href="#fn-a" role="doc-noteref">1</a></sup></p></td></tr></table>`,
	} {
		t.Run(name, func(t *testing.T) {
			source := carrier + `<p>Outside<sup><a id="ref-b" href="#fn-a" role="doc-noteref">1</a></sup></p><section data-footnotes=""><ol><li id="fn-a"><p>Definition</p><a href="#ref-a" role="doc-backlink">Back</a><a href="#ref-b" role="doc-backlink">Back again</a></li></ol></section>`
			for range 2 {
				converted, err := htmlToMarkdown(source)
				require.NoError(t, err)
				source, err = markdown.ToHTML(converted)
				require.NoError(t, err)
				doc, err := goquery.NewDocumentFromReader(strings.NewReader(source))
				require.NoError(t, err)
				assert.Equal(t, 2, doc.Find(`[role="doc-noteref"]`).Length())
				definitions := doc.Find(`[role="doc-endnotes"] li, [data-footnotes] li, .footnotes li`)
				assert.Equal(t, 1, definitions.Length())
				assert.Equal(t, "Definition", definitions.ChildrenFiltered("p").Text())
				assert.Equal(t, 2, doc.Find(`[role="doc-backlink"]`).Length())
				doc.Find(`[role="doc-noteref"], [role="doc-backlink"]`).Each(func(_ int, link *goquery.Selection) {
					target := strings.TrimPrefix(link.AttrOr("href", ""), "#")
					assert.Equal(t, 1, doc.Find(`[id="`+target+`"]`).Length(), target)
				})
				if name == "details" {
					assert.Equal(t, "first\n\n**literal**", doc.Find("details pre code").Text())
				}
			}
		})
	}
}

func TestHTMLToMarkdown_FormattedFootnoteSup(t *testing.T) {
	source := "<p>A<sup>\n<a href=\"#fn-n\">1</a>\n</sup></p><section data-footnotes><ol><li id=\"fn-n\"><p>Definition</p></li></ol></section>"
	converted, err := htmlToMarkdown(source)
	require.NoError(t, err)
	assert.Contains(t, converted, "A[^1]")
	assert.Contains(t, converted, "[^1]: Definition")
	roundTrip, err := markdown.ToHTML(converted)
	require.NoError(t, err)
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(roundTrip))
	require.NoError(t, err)
	assert.Equal(t, 1, doc.Find(`[role="doc-noteref"]`).Length())
	assert.Contains(t, doc.Find(`[role="doc-endnotes"]`).Text(), "Definition")
}
