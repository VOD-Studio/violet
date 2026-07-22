package post

import (
	"strings"
	"testing"

	"golang.org/x/net/html"
)

// TestExtractKaTeXText 验证从 KaTeX 渲染 DOM 提取近似公式文本。
// 这是 LLM 反推的精准输入，必须能从装饰 span 里提取出 "E = mc²" 这种可读文本。
func TestExtractKaTeXText(t *testing.T) {
	cases := []struct {
		name string
		html string
		want string
	}{
		{
			name: "行内公式 E=mc²",
			// 模拟 KaTeX 渲染：mathnormal/mrel 等 span 包裹符号
			html: `<span class="katex"><span class="katex-html"><span class="base"><span class="mord mathnormal" style="margin-right:0.0576em;">E</span><span class="mrel">=</span><span class="mord mathnormal">m</span><span class="mord"><span class="mord mathnormal">c</span><span class="msupsub"><span class="vlist-t"><span class="viarlist-r"><span class="vlist"><span class="sizing">2</span></span></span></span></span></span></span></span></span>`,
			want: "E=mc2",
		},
		{
			name: "应排除 katex-mathml（避免重复文本）",
			html: `<span class="katex"><span class="katex-mathml"><math><mi>x</mi></math></span><span class="katex-html"><span class="base"><span class="mord mathnormal">y</span></span></span></span>`,
			want: "y",
		},
		{
			name: "空节点返回空",
			html: `<span class="katex"></span>`,
			want: "",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			doc := parseDoc(t, wrapArticle(`<p>`+c.html+`</p>`))
			// 找到 .katex 节点
			katexNodes := findAllByClass(doc, "span", "katex")
			if len(katexNodes) == 0 {
				t.Fatalf("未找到 .katex 节点")
			}
			got := extractKaTeXText(katexNodes[0])
			// 去空白比较（KaTeX DOM 有时会有空白字符）
			if strings.TrimSpace(got) != c.want {
				t.Errorf("期望 %q，实际 %q", c.want, strings.TrimSpace(got))
			}
		})
	}
}

// TestReplaceKaTeXWithPlaceholder_PreservesFormulaText 验证占位保留了 KaTeX 文本快照。
func TestReplaceKaTeXWithPlaceholder_PreservesFormulaText(t *testing.T) {
	// 模拟 rua.plus 式无源码块级公式：有 .katex-html 渲染节点但无 annotation
	htmlDoc := wrapArticle(`<p>求和：<span class="katex-display"><span class="katex"><span class="katex-html"><span class="base"><span class="mord">∑</span></span></span></span></span> end</p>`)
	out := renderWithPipeline(t, htmlDoc)
	// 未启用 LLM 时应回退为 $$ $$ 占位（formulaText 存在但不用）
	if !strings.Contains(out, "$$ $$") {
		t.Errorf("期望未启用 LLM 时块级占位为 $$ $$，实际:\n%s", out)
	}
}

// TestCollectPlaceholders_OrderAndFields 验证占位收集的顺序与字段。
func TestCollectPlaceholders_OrderAndFields(t *testing.T) {
	// 构造含两个占位的 HTML，手动遍历前不调 markBlock/markInline
	htmlDoc := wrapArticle(`<p><span class="mathjax-legacy" data-mj-latex="a+b" data-mj-formula-text="a + b">a+b</span> and <span class="mathjax-legacy" data-mj-block="1" data-mj-latex="" data-mj-formula-text="sum">sum</span></p>`)
	doc := parseDoc(t, htmlDoc)
	placeholders := collectPlaceholders(doc)
	if len(placeholders) != 2 {
		t.Fatalf("期望 2 个占位，实际 %d", len(placeholders))
	}
	if placeholders[0].Latex != "a+b" || placeholders[0].IsBlock {
		t.Errorf("第一个占位字段错误: %+v", placeholders[0])
	}
	if !placeholders[1].IsBlock || placeholders[1].FormulaText != "sum" {
		t.Errorf("第二个占位字段错误: %+v", placeholders[1])
	}
}

// TestSetPlaceholderLatex 验证能注入 LLM 反推结果。
func TestSetPlaceholderLatex(t *testing.T) {
	htmlDoc := wrapArticle(`<p><span class="mathjax-legacy" data-mj-formula-text="E = mc²">FORMULA</span></p>`)
	doc := parseDoc(t, htmlDoc)
	placeholders := collectPlaceholders(doc)
	if len(placeholders) != 1 {
		t.Fatalf("期望 1 个占位，实际 %d", len(placeholders))
	}
	SetPlaceholderLatex(&placeholders[0], "E=mc^2")
	finalizePlaceholders(placeholders)
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	if !strings.Contains(buf.String(), "$E=mc^2$") {
		t.Errorf("期望含 $E=mc^2$，实际 %q", buf.String())
	}
}
