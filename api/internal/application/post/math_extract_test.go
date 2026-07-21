package post

import (
	"strings"
	"testing"

	readability "codeberg.org/readeck/go-readability/v2"
	"golang.org/x/net/html"
)

// renderWithPipeline 模拟 service.go 的 readability 处理流程，返回 article HTML。
func renderWithPipeline(t *testing.T, rawHTML string) string {
	t.Helper()
	doc, err := html.Parse(strings.NewReader(rawHTML))
	if err != nil {
		t.Fatalf("html.Parse 失败: %v", err)
	}
	preserveMathJaxScripts(doc)

	p := readability.NewParser()
	p.KeepClasses = true
	art, err := p.ParseDocument(doc, nil)
	if err != nil {
		t.Fatalf("ParseDocument 失败: %v", err)
	}
	if art.Node != nil {
		restoreMathNodes(art.Node)
	}

	var buf strings.Builder
	if err := art.RenderHTML(&buf); err != nil {
		t.Fatalf("RenderHTML 失败: %v", err)
	}
	return buf.String()
}

// TestMathRestore_StandardKaTeXInline 验证标准 KaTeX 行内公式能从 annotation 还原为 $...$。
func TestMathRestore_StandardKaTeXInline(t *testing.T) {
	htmlDoc := wrapArticle(`<p>公式 <span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>E</mi></mrow><annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math></span><span class="katex-html">RENDERED</span></span> end</p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$E=mc^2$") {
		t.Errorf("期望行内公式还原为 $E=mc^2$，实际:\n%s", out)
	}
	if strings.Contains(out, "katex-html") {
		t.Errorf("katex 渲染 DOM 应被清除，实际:\n%s", out)
	}
}

// TestMathRestore_StandardKaTeXBlock 验证标准 KaTeX 块级公式（带 katex-display 类）还原为 $$...$$。
func TestMathRestore_StandardKaTeXBlock(t *testing.T) {
	htmlDoc := wrapArticle(`<p><span class="katex katex-display"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">\int_0^1 x\,dx</annotation></semantics></math></span><span class="katex-html">RENDERED</span></span></p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$$\\int_0^1 x\\,dx$$") {
		t.Errorf("期望块级公式还原为 $$..$$，实际:\n%s", out)
	}
}

// TestMathRestore_MathJaxInline 验证 MathJax 行内 <script type="math/tex"> 在 readability 删除前被保留。
func TestMathRestore_MathJaxInline(t *testing.T) {
	htmlDoc := wrapArticle(`<p>行内 <script type="math/tex">x^2 + y^2 = r^2</script> end</p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$x^2 + y^2 = r^2$") {
		t.Errorf("期望 MathJax 行内还原为 $x^2 + y^2 = r^2$，实际:\n%s", out)
	}
}

// TestMathRestore_MathJaxBlock 验证 MathJax 块级 <script type="math/tex; mode=display"> 还原为 $$...$$。
func TestMathRestore_MathJaxBlock(t *testing.T) {
	htmlDoc := wrapArticle(`<p>块级公式 <script type="math/tex; mode=display">\sum_{i=1}^n i = \frac{n(n+1)}{2}</script> 结束</p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$") {
		t.Errorf("期望 MathJax 块级还原为 $$..$$，实际:\n%s", out)
	}
}

// TestMathRestore_NoSourcePlaceholder 验证无源码 KaTeX（如 rua.plus 关闭 mathml）还原为 $ $ 占位。
func TestMathRestore_NoSourcePlaceholder(t *testing.T) {
	htmlDoc := wrapArticle(`<p>无源码 <span class="katex"><span class="katex-html">RENDERED_ONLY</span></span> end</p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$ $") {
		t.Errorf("期望无源码公式还原为 $ $ 空占位，实际:\n%s", out)
	}
	if strings.Contains(out, "RENDERED_ONLY") {
		t.Errorf("无源码渲染 DOM 应被清除，实际:\n%s", out)
	}
}

// TestMathRestore_KaTeXAnnotationTrimmed 验证 annotation 内容被正确 trim。
func TestMathRestore_KaTeXAnnotationTrimmed(t *testing.T) {
	htmlDoc := wrapArticle(`<p><span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">  a+b  </annotation></semantics></math></span></span></p>`)
	out := renderWithPipeline(t, htmlDoc)
	if !strings.Contains(out, "$a+b$") {
		t.Errorf("期望源码被 trim 后还原为 $a+b$，实际:\n%s", out)
	}
}

// wrapArticle 把正文 HTML 包成完整文档结构，方便 readability 处理。
func wrapArticle(body string) string {
	return `<!DOCTYPE html><html><head><title>Test</title></head><body><article><h1>Title</h1>` + body + `</article></body></html>`
}
