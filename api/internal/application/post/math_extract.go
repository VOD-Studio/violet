package post

import (
	"bytes"
	"strings"

	"golang.org/x/net/html"
)

// 数学公式还原相关常量。
//
// 站点把 KaTeX/MathJax 渲染后的 DOM 直接嵌进 HTML（SSR 标准做法），导入时需要把
// 这些渲染 DOM 还原成 LaTeX 源码（$...$ / $$...$$），否则 Tiptap 解析为普通 span。
//
// 两类源码载体：
//   - 标准 KaTeX：<span class="katex">...<annotation encoding="application/x-tex">LATEX</annotation>...</span>
//     annotation 是 KaTeX 的无障碍层，readability 不会删，处理后仍存活。
//   - MathJax：<script type="math/tex">LATEX</script> 或 <script type="math/tex; mode=display">
//     readability 的 removeScripts 会删所有 <script>，必须在 ParseDocument 前替换成占位 span。
//
// 无源码的渲染 DOM（如 rua.plus 关闭了 mathml 层）→ 还原成空的 $ $ 占位，由用户手动补。
const (
	// mathJaxPlaceholder 标记 MathJax 占位 span 的 data 属性名
	mathJaxLatexAttr = "data-mj-latex"
	mathJaxBlockAttr = "data-mj-block"
)

// preserveMathJaxScripts 把原始 doc 里的 MathJax <script type="math/tex*"> 替换成
// 带 data 属性的占位 <span>，避免 readability 的 removeScripts 删除。
//
// 必须在 parser.ParseDocument 之前调用（ParseDocument 内部会 Clone doc，占位 span 随之进入处理流）。
func preserveMathJaxScripts(doc *html.Node) {
	scriptNodes := findMathJaxScripts(doc)
	for _, script := range scriptNodes {
		latex := strings.TrimSpace(textContent(script))
		// 块级由 type="math/tex; mode=display" 标识（注意是 type 属性，不是 script.Data）
		isBlock := strings.Contains(strings.ToLower(getAttr(script, "type")), "mode=display")
		placeholder := &html.Node{
			Type: html.ElementNode,
			Data: "span",
		}
		placeholder.Attr = []html.Attribute{
			{Key: "class", Val: "mathjax-legacy"},
			{Key: mathJaxLatexAttr, Val: latex},
		}
		if isBlock {
			placeholder.Attr = append(placeholder.Attr, html.Attribute{Key: mathJaxBlockAttr, Val: "1"})
		}
		// 把 script 的位置让给 placeholder
		script.Parent.InsertBefore(placeholder, script)
		script.Parent.RemoveChild(script)
	}
}

// findMathJaxScripts 递归查找所有 <script type="math/tex"> 和 <script type="math/tex; mode=display">。
func findMathJaxScripts(n *html.Node) []*html.Node {
	var result []*html.Node
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "script" {
			if isMathJaxScript(getAttr(node, "type")) {
				result = append(result, node)
			}
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return result
}

func isMathJaxScript(typ string) bool {
	t := strings.ToLower(typ)
	return t == "math/tex" || strings.HasPrefix(t, "math/tex;")
}

// restoreMathNodes 遍历 readability 处理后的 article.Node，把公式 DOM 还原成 LaTeX：
//   - 标准 KaTeX：取 annotation 文本 → $...$ / $$...$$
//   - MathJax 占位 span（preserveMathJaxScripts 注入）：读 data-mj-latex → $...$ / $$...$$
//   - 无源码 KaTeX（如 rua.plus）：替换成空 $ $ 占位
//
// KaTeX 的 display 模式由 .katex-display 类标识；MathJax 由 data-mj-block 标识。
func restoreMathNodes(root *html.Node) {
	// 收集所有需要替换的节点（遍历过程中不能边找边删）
	var replacements []nodeReplacement
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "span" {
			class := getAttr(n, "class")
			if hasClass(class, "mathjax-legacy") {
				replacements = append(replacements, mathReplacementFromMathJax(n))
			} else if hasClass(class, "katex") {
				replacements = append(replacements, mathReplacementFromKaTeX(n))
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)

	for _, r := range replacements {
		insertTextNode(r.target, r.text)
	}
}

type nodeReplacement struct {
	target *html.Node
	text   string
}

func mathReplacementFromMathJax(span *html.Node) nodeReplacement {
	latex := getAttr(span, mathJaxLatexAttr)
	isBlock := getAttr(span, mathJaxBlockAttr) == "1"
	text := wrapLatex(latex, isBlock)
	return nodeReplacement{target: span, text: text}
}

func mathReplacementFromKaTeX(katexSpan *html.Node) nodeReplacement {
	latex := findKatexAnnotation(katexSpan)
	isBlock := hasClass(getAttr(katexSpan, "class"), "katex-display")
	// 无源码（如 rua.plus 关闭 mathml 层）→ 空 $ $ 占位，位置不丢
	text := wrapLatex(latex, isBlock)
	return nodeReplacement{target: katexSpan, text: text}
}

// findKatexAnnotation 在 katex 节点子树里找 <annotation encoding="application/x-tex">。
func findKatexAnnotation(katexSpan *html.Node) string {
	var found string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if found != "" {
			return
		}
		if n.Type == html.ElementNode && n.Data == "annotation" {
			if strings.EqualFold(getAttr(n, "encoding"), "application/x-tex") {
				found = strings.TrimSpace(textContent(n))
				return
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(katexSpan)
	return found
}

// wrapLatex 把 LaTeX 源码包成 markdown 公式语法：行内 $...$，块级 $$...$$。
// 空 latex（如 rua.plus 关闭了 mathml 层）→ 加一个空格避免 $$ 被解析为转义，由用户手动补源码。
func wrapLatex(latex string, display bool) string {
	latex = strings.TrimSpace(latex)
	if latex == "" {
		latex = " "
	}
	if display {
		return "$$" + latex + "$$"
	}
	return "$" + latex + "$"
}

// insertTextNode 用一个文本节点替换 target 元素节点（保留位置）。
func insertTextNode(target *html.Node, text string) {
	textNode := &html.Node{
		Type: html.TextNode,
		Data: text,
	}
	target.Parent.InsertBefore(textNode, target)
	target.Parent.RemoveChild(target)
}

// getAttr 读元素的属性值，不存在返回空串。
func getAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

// hasClass 判断 class 属性里是否包含指定类名（空格分隔）。
func hasClass(class, target string) bool {
	for _, c := range strings.Fields(class) {
		if c == target {
			return true
		}
	}
	return false
}

// textContent 递归收集节点子树的纯文本（含 script/style 内容）。
func textContent(n *html.Node) string {
	var buf bytes.Buffer
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.TextNode {
			buf.WriteString(node.Data)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return buf.String()
}
