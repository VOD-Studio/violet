package post

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
