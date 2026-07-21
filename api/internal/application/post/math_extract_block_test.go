package post

import (
	"strings"
	"testing"
)

// TestMathRestore_BlockKaTeXDisplayNoSource 验证 markBlockKaTeX 能正确处理无源码的块级 KaTeX。
// rua.plus 真实结构：<span class="katex-display"><span class="katex">...（无 annotation）。
// 块级 wrapper 内部全是装饰 span（无文本），readability 会判定为空节点删除。
// markBlockKaTeX 必须在 readability 处理前把它替换成有文本的占位 span，否则位置丢失。
func TestMathRestore_BlockKaTeXDisplayNoSource(t *testing.T) {
	htmlDoc := wrapArticle(`<p>求和：<span class="katex-display"><span class="katex"><span class="katex-html">RENDERED</span></span></span> end</p>`)
	out := renderWithPipelineMarkBlock(t, htmlDoc)
	if !strings.Contains(out, "$$ $$") {
		t.Errorf("期望无源码块级公式还原为 $$ $$ 占位，实际:\n%s", out)
	}
	if strings.Contains(out, "katex-display") || strings.Contains(out, "mathjax-legacy") {
		t.Errorf("块级 wrapper/占位 span 应被替换清除，实际:\n%s", out)
	}
}

// TestMathRestore_BlockKaTeXDisplayWithSource 验证有源码的块级 KaTeX（标准输出）也能正确还原。
func TestMathRestore_BlockKaTeXDisplayWithSource(t *testing.T) {
	htmlDoc := wrapArticle(`<p><span class="katex-display"><span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">\sum_{i=1}^n i</annotation></semantics></math></span><span class="katex-html">RENDERED</span></span></span></p>`)
	out := renderWithPipelineMarkBlock(t, htmlDoc)
	if !strings.Contains(out, "$$\\sum_{i=1}^n i$$") {
		t.Errorf("期望有源码块级公式还原为 $$\\sum_{i=1}^n i$$，实际:\n%s", out)
	}
}

// TestMathRestore_InlineKaTeXUnaffected 验证 markBlockKaTeX 不影响行内公式（无 .katex-display wrapper）。
func TestMathRestore_InlineKaTeXUnaffected(t *testing.T) {
	htmlDoc := wrapArticle(`<p>行内 <span class="katex"><span class="katex-html">RENDERED</span></span> end</p>`)
	out := renderWithPipelineMarkBlock(t, htmlDoc)
	if !strings.Contains(out, "$ $") {
		t.Errorf("期望行内无源码公式还原为 $ $，实际:\n%s", out)
	}
	if strings.Contains(out, "$$") {
		t.Errorf("行内公式不应被识别为块级，实际:\n%s", out)
	}
}
