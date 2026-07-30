package post

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// markdownToHTML 是 MCP create_post 缺 content_html 时的应用层兜底。
// 这些测试锁定 violet 编辑器 schema 的四类 carrier 必须正确产出，否则
// 编辑页加载后无数据、阅读端降级渲染格式全无（线上 markdown-full-features-test 复现）。

func TestMarkdownToHTML_Empty(t *testing.T) {
	out, err := markdownToHTML("")
	require.NoError(t, err)
	assert.Equal(t, "", out)
}

func TestMarkdownToHTML_Headings(t *testing.T) {
	out, err := markdownToHTML("## 标题\n\n正文段落")
	require.NoError(t, err)
	assert.Contains(t, out, "<h2")
	assert.Contains(t, out, "标题")
	assert.Contains(t, out, "<p>正文段落</p>")
}

func TestMarkdownToHTML_Strikethrough(t *testing.T) {
	out, err := markdownToHTML("~~删除~~")
	require.NoError(t, err)
	assert.Contains(t, out, "<del>删除</del>")
}

func TestMarkdownToHTML_Table(t *testing.T) {
	md := "| a | b |\n| --- | --- |\n| 1 | 2 |\n"
	out, err := markdownToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, "<table>")
	assert.Contains(t, out, "<th>a</th>")
	assert.Contains(t, out, "<td>1</td>")
}

func TestMarkdownToHTML_FencedCodeWithLanguage(t *testing.T) {
	md := "```rust\nfn main() {}\n```\n"
	out, err := markdownToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<code class="language-rust">`)
	assert.Contains(t, out, "fn main() {}")
}

func TestMarkdownToHTML_InlineMathCarrier(t *testing.T) {
	out, err := markdownToHTML("质能方程 $E = mc^2$ 成立")
	require.NoError(t, err)
	assert.Contains(t, out, `<span data-type="inline-math" data-latex="E = mc^2">`,
		"行内公式须产出 inline-math carrier，供编辑器/阅读端识别")
	// 公式原文 $...$ 不应残留为纯文本
	assert.NotContains(t, out, "$E = mc^2$")
}

func TestMarkdownToHTML_BlockMathCarrier(t *testing.T) {
	md := "$$\\int_{0}^{1} x\\,dx$$\n"
	out, err := markdownToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<div data-type="block-math" data-latex="\int_{0}^{1} x\,dx">`,
		"块级公式须产出 block-math div carrier（而非嵌入 <p>）")
	assert.NotContains(t, out, "<p>"+phPrefix)
}

func TestMarkdownToHTML_MermaidDiagramBlockCarrier(t *testing.T) {
	md := "```mermaid\ngraph TD\nA --> B\n```\n"
	out, err := markdownToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, `<div data-type="diagram-block" data-format="mermaid"`,
		"mermaid 围栏须产出 diagram-block carrier，而非普通代码块")
	assert.Contains(t, out, `data-source="graph TD`)
	assert.NotContains(t, out, "language-mermaid")
}

func TestMarkdownToHTML_TaskListCarrier(t *testing.T) {
	md := "- [x] 已完成\n- [ ] 未完成\n"
	out, err := markdownToHTML(md)
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
	out, err := markdownToHTML(md)
	require.NoError(t, err)
	assert.Contains(t, out, "<ul>")
	assert.NotContains(t, out, "data-type=\"taskList\"")
}

func TestMarkdownToHTML_DollarAmountNotMath(t *testing.T) {
	// 美元金额不应被误判为公式
	out, err := markdownToHTML("售价 $5 的商品")
	require.NoError(t, err)
	// $5 不满足 looksLikeLatex，原样保留
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
	out, err := markdownToHTML(md)
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

// ensureContentHTML 是 service.Create/Update 的兜底入口。下面覆盖四类边界：
func TestEnsureContentHTML_GeneratesWhenHTMLMissing(t *testing.T) {
	// MCP 路径：只传 md，html 空 → 生成
	html := ""
	ensureContentHTML(&html, "## 标题")
	assert.NotEmpty(t, html, "html 缺失且有 md 时应兜底生成")
	assert.Contains(t, html, "<h2")
}

func TestEnsureContentHTML_NoopWhenHTMLPresent(t *testing.T) {
	// admin REST 路径：html 已有 → 不覆盖
	html := "<p>已有</p>"
	ensureContentHTML(&html, "## 别的")
	assert.Equal(t, "<p>已有</p>", html, "html 非空时不应被覆盖")
}

func TestEnsureContentHTML_NoopWhenBothEmpty(t *testing.T) {
	// 仅改 title/tags 的更新：md 与 html 都空 → 不动（避免误清空已有正文）
	html := ""
	ensureContentHTML(&html, "")
	assert.Equal(t, "", html, "md 与 html 都空时不应生成")
}

func TestEnsureContentHTML_NoopWhenMDWhitespaceOnly(t *testing.T) {
	html := ""
	ensureContentHTML(&html, "   \n\t  ")
	assert.Equal(t, "", html, "md 仅空白时不应生成")
}

func TestEnsureContentHTML_NilPointerSafe(t *testing.T) {
	// nil 指针不应 panic
	assert.NotPanics(t, func() { ensureContentHTML(nil, "## x") })
}
