package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ToHTML 是 MCP create_post 缺 content_html 时的应用层兜底。
// 这些测试锁定 violet 编辑器 schema 的四类 carrier 必须正确产出，否则
// 编辑页加载后无数据、阅读端降级渲染格式全无（线上 markdown-full-features-test 复现）。

func TestMarkdownToHTML_Empty(t *testing.T) {
	out, err := ToHTML("")
	require.NoError(t, err)
	assert.Equal(t, "", out)
}

func TestMarkdownToHTML_Headings(t *testing.T) {
	out, err := ToHTML("## 标题\n\n正文段落")
	require.NoError(t, err)
	assert.Contains(t, out, "<h2")
	assert.Contains(t, out, "标题")
	assert.Contains(t, out, "<p>正文段落</p>")
}

func TestMarkdownToHTML_Strikethrough(t *testing.T) {
	out, err := ToHTML("~~删除~~")
	require.NoError(t, err)
	assert.Contains(t, out, "<del>删除</del>")
}

func TestMarkdownToHTML_Table(t *testing.T) {
	md := "| a | b |\n| --- | --- |\n| 1 | 2 |\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, "<table>")
	assert.Contains(t, out, "<th>a</th>")
	assert.Contains(t, out, "<td>1</td>")
}

func TestMarkdownToHTML_FencedCodeWithLanguage(t *testing.T) {
	md := "```rust\nfn main() {}\n```\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<code class="language-rust">`)
	assert.Contains(t, out, "fn main() {}")
}

func TestMarkdownToHTML_InlineMathCarrier(t *testing.T) {
	out, err := ToHTML("质能方程 $E = mc^2$ 成立")
	require.NoError(t, err)
	assert.Contains(t, out, `<span data-type="inline-math" data-latex="E = mc^2">`,
		"行内公式须产出 inline-math carrier，供编辑器/阅读端识别")
	// 公式原文 $...$ 不应残留为纯文本
	assert.NotContains(t, out, "$E = mc^2$")
}

func TestMarkdownToHTML_BlockMathCarrier(t *testing.T) {
	md := "$$\\int_{0}^{1} x\\,dx$$\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<div data-type="block-math" data-latex="\int_{0}^{1} x\,dx">`,
		"块级公式须产出 block-math div carrier（而非嵌入 <p>）")
	assert.NotContains(t, out, "<p><div")
}

func TestMarkdownToHTML_MermaidDiagramBlockCarrier(t *testing.T) {
	md := "```mermaid\ngraph TD\nA --> B\n```\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<div data-type="diagram-block" data-format="mermaid"`,
		"mermaid 围栏须产出 diagram-block carrier，而非普通代码块")
	assert.Contains(t, out, `data-source="graph TD`)
	assert.NotContains(t, out, "language-mermaid")
}

func TestMarkdownToHTML_TaskListCarrier(t *testing.T) {
	md := "- [x] 已完成\n- [ ] 未完成\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<ul data-type="taskList">`,
		"任务列表须产出 taskList ul carrier")
	assert.Contains(t, out, `<li data-type="taskItem" data-checked="true">`, "checked 项须标 true")
	assert.Contains(t, out, `<li data-type="taskItem" data-checked="false">`, "unchecked 项须标 false")
	// goldmark 的 checkbox <input> 应被移除（语义已进 data-checked）
	assert.NotContains(t, out, "checkbox")
}

func TestMarkdownToHTML_PlainListUntouched(t *testing.T) {
	// 普通列表不应被误标为 taskList
	md := "- 第一项\n- 第二项\n"
	out, err := ToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, "<ul>")
	assert.NotContains(t, out, "data-type=\"taskList\"")
}

func TestMarkdownToHTML_DollarAmountNotMath(t *testing.T) {
	// 美元金额不应被误判为公式
	out, err := ToHTML("售价 $5 的商品")
	require.NoError(t, err)
	// 未配对美元金额应原样保留
	assert.Contains(t, out, "$5")
	assert.NotContains(t, out, "inline-math")
}

// 端到端：用真实抓取文章的典型片段，断言所有 carrier 齐备。
func TestMarkdownToHTML_RealisticMixed(t *testing.T) {
	md := `## 一、标题

行内公式 $a^2 + b^2 = c^2$ 与代码 ` + "`cargo build`" + `。

$$\hat{H}\Psi = E\Psi$$

` + "```mermaid" + `
graph TD
A --> B
` + "```" + `

- [x] 完成
- [ ] 未完

| 语言 | 扩展名 |
| --- | --- |
| Go | go |
`
	out, err := ToHTML(md)
	require.NoError(t, err)
	for _, c := range []string{
		"<h2",                            // 标题
		`<span data-type="inline-math"`,  // 行内公式
		`<div data-type="block-math"`,    // 块级公式
		`<div data-type="diagram-block"`, // mermaid
		`<ul data-type="taskList">`,      // 任务列表
		"<table>",                        // 表格
		"<code>",                         // 内联代码
	} {
		assert.Contains(t, out, c)
	}
}

// EnsureHTML 是 service.Create/Update 的兜底入口。下面覆盖四类边界：
func TestEnsureContentHTML_GeneratesWhenHTMLMissing(t *testing.T) {
	// MCP 路径：只传 md，html 空 → 生成
	html := ""
	EnsureHTML(&html, "## 标题")
	assert.NotEmpty(t, html, "html 缺失且有 md 时应兜底生成")
	assert.Contains(t, html, "<h2")
}

func TestEnsureContentHTML_NoopWhenHTMLPresent(t *testing.T) {
	// admin REST 路径：html 已有 → 不覆盖
	html := "<p>已有</p>"
	EnsureHTML(&html, "## 别的")
	assert.Equal(t, "<p>已有</p>", html, "html 非空时不应被覆盖")
}

func TestEnsureContentHTML_NoopWhenBothEmpty(t *testing.T) {
	// 仅改 title/tags 的更新：md 与 html 都空 → 不动（避免误清空已有正文）
	html := ""
	EnsureHTML(&html, "")
	assert.Equal(t, "", html, "md 与 html 都空时不应生成")
}

func TestEnsureContentHTML_NoopWhenMDWhitespaceOnly(t *testing.T) {
	html := ""
	EnsureHTML(&html, "   \n\t  ")
	assert.Equal(t, "", html, "md 仅空白时不应生成")
}

func TestEnsureContentHTML_NilPointerSafe(t *testing.T) {
	// nil 指针不应 panic
	assert.NotPanics(t, func() { EnsureHTML(nil, "## x") })
}

func TestMarkdownToHTML_SyntaxContext(t *testing.T) {
	for name, source := range map[string]string{
		"inline code":          "`$x$ $$y$$ ==mark==`",
		"multiline code span":  "``$x$\n$$y$$ ==mark==``",
		"backtick fence":       "````text\n$x$ $$y$$ ==mark==\n```\n````",
		"tilde fence":          "~~~~text\n$x$ $$y$$ ==mark==\n~~~~",
		"indented code":        "    $x$ $$y$$ ==mark==",
		"escaped and currency": `\$x\$ costs $5 or $10 and US$20.`,
	} {
		t.Run(name, func(t *testing.T) {
			out, err := ToHTML(source)
			require.NoError(t, err)
			assert.NotContains(t, out, `data-type="inline-math"`)
			assert.NotContains(t, out, `data-type="block-math"`)
			assert.NotContains(t, out, "<mark>")
		})
	}
	out, err := ToHTML("$x$ and $y$ ==**important**==\n\n> $$\n> x_1 + y_2\n> $$")
	require.NoError(t, err)
	assert.Contains(t, out, `data-latex="x"`)
	assert.Contains(t, out, `data-latex="y"`)
	assert.Contains(t, out, "<mark><strong>important</strong></mark>")
	assert.Contains(t, out, "<blockquote>\n<div")
	assert.Contains(t, out, `data-latex="x_1 + y_2"`)
}

func TestMarkdownToHTML_FenceVariants(t *testing.T) {
	for _, source := range []string{
		"````mermaid\ngraph TD\nA --> B\n`````",
		"~~~~mermaid\ngraph TD\nA --> B\n~~~~",
		"> ```mermaid\n> graph TD\n> A --> B\n> ```",
		"- diagram\n\n  ~~~mermaid\n  graph TD\n  A --> B\n  ~~~",
	} {
		out, err := ToHTML(source)
		require.NoError(t, err)
		assert.Contains(t, out, `data-type="diagram-block"`)
		assert.Contains(t, out, "graph TD\nA --&gt; B")
		assert.NotContains(t, out, "language-mermaid")
	}
	out, err := ToHTML("> ~~~mermaid\ngraph TD\n~~~")
	require.NoError(t, err)
	assert.Contains(t, out, "<blockquote>")
}

func TestMarkdownToHTML_RunnableMetadata(t *testing.T) {
	out, err := ToHTML("~~~~js run {\"timeout_secs\": 10, \"memory_mb\": 64}\nconsole.log('$x$')\n~~~~")
	require.NoError(t, err)
	assert.Contains(t, out, `data-runnable="true"`)
	assert.Contains(t, out, `data-lang="node"`)
	assert.Contains(t, out, `data-overrides="{`)
	assert.Contains(t, out, `&#34;timeout_secs&#34;:10`)
	assert.Contains(t, out, `&#34;memory_mb&#34;:64`)
	assert.Contains(t, out, `data-source="console.log(&#39;$x$&#39;)"`)
	assert.NotContains(t, out, "inline-math")
}

func TestMarkdownToHTML_Footnotes(t *testing.T) {
	out, err := ToHTML("First[^note], again[^note].\n\n[^note]: First paragraph $x$.\n\n    Second paragraph **bold**.")
	require.NoError(t, err)
	for _, expected := range []string{
		`id="fnref:1"`, `id="fnref1:1"`, `href="#fn:1"`, `id="fn:1"`,
		`href="#fnref:1"`, `href="#fnref1:1"`, `role="doc-endnotes"`,
		"First paragraph", "<p>Second paragraph <strong>bold</strong>",
	} {
		assert.Contains(t, out, expected)
	}
}

func TestMarkdownToHTML_LooseTaskListsAndRawTable(t *testing.T) {
	out, err := ToHTML("- [x] First\n\n  Second paragraph.\n\n- [ ] Next\n\n<table><tr><td colspan=\"2\" rowspan=\"3\">cell</td></tr></table>")
	require.NoError(t, err)
	assert.Contains(t, out, `data-type="taskList"`)
	assert.Contains(t, out, `data-checked="true"`)
	assert.Contains(t, out, `data-checked="false"`)
	assert.NotContains(t, out, "<input")
	assert.Contains(t, out, `colspan="2" rowspan="3"`)
}
