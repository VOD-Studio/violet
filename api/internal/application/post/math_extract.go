package post

import (
	"bytes"
	"strings"

	"golang.org/x/net/html"

	"blog-api/internal/application/markdown"
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
	mathJaxLatexAttr       = "data-mj-latex"
	mathJaxBlockAttr       = "data-mj-block"
	mathJaxFormulaTextAttr = "data-mj-formula-text"
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
		isBlock := strings.Contains(strings.ToLower(markdown.GetAttr(script, "type")), "mode=display")
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

// markBlockKaTeX 在原始 doc 上把 .katex-display wrapper 整体替换成 MathJax 占位 span。
//
// 必要性：块级公式外层 .katex-display wrapper 内部是纯装饰 span（katex-html 的 strut/base 等），
// 无文本内容，readability 的 grabArticle 会判定为「空节点」整个删除。结果块级公式在处理后 doc 上
// 完全消失，位置和块级标识都丢了（用户看到「求和：」后接残缺的 $）。
//
// 方案：在 readability 处理前，把 .katex-display 整体替换成 mathjax-legacy 占位 span
// （复用 MathJax 占位机制），占位 span 自带文本内容 readability 会保留。
//
// 占位文本策略（优先级递减）：
//  1. latex 源码（从 annotation 提取，标准 KaTeX 站点）
//  2. formulaText（KaTeX DOM 的 textContent，如 "E = mc²"，rua.plus 等无源码站点）
//  3. "FORMULA" 兜底
//
// latex 存入 data-mj-latex 供直接还原；formulaText 存入 data-mj-formula-text 供 LLM 反推。
func markBlockKaTeX(doc *html.Node) {
	for _, wrapper := range findAllByClass(doc, "span", "katex-display") {
		replaceKaTeXWithPlaceholder(wrapper, true)
	}
}

// markInlineKaTeX 在原始 doc 上把行内 .katex 节点替换成占位 span。
//
// 必要性：行内 .katex 的 .katex-html 子树同样是装饰 span，readability 可能压平或丢失文本。
// 统一替换成带文本的占位 span 保证位置与文本快照都不丢，且与块级走同一条 restoreMathNodes 路径。
// 已被 markBlockKaTeX 替换的块级公式（.katex-display 子树里的 .katex）不再处理。
func markInlineKaTeX(doc *html.Node) {
	// 先收集再替换，避免遍历过程中改树
	for _, katex := range findAllByClass(doc, "span", "katex") {
		// 跳过已被 markBlockKaTeX 包在占位里的（占位已替换原 wrapper，理论上不会再遇到）
		// 防御性检查：父节点是 mathjax-legacy 占位的跳过
		if katex.Parent != nil && hasClass(markdown.GetAttr(katex.Parent, "class"), "mathjax-legacy") {
			continue
		}
		replaceKaTeXWithPlaceholder(katex, false)
	}
}

// replaceKaTeXWithPlaceholder 把一个 KaTeX 节点（块级 wrapper 或行内 .katex）替换成占位 span。
func replaceKaTeXWithPlaceholder(node *html.Node, display bool) {
	latex := findKatexAnnotation(node)
	formulaText := strings.TrimSpace(extractKaTeXText(node))
	placeholderText := latex
	if placeholderText == "" {
		placeholderText = formulaText
	}
	if placeholderText == "" {
		placeholderText = "FORMULA"
	}
	placeholder := &html.Node{
		Type: html.ElementNode,
		Data: "span",
	}
	placeholder.AppendChild(&html.Node{Type: html.TextNode, Data: placeholderText})
	placeholder.Attr = []html.Attribute{
		{Key: "class", Val: "mathjax-legacy"},
		{Key: mathJaxLatexAttr, Val: latex},
		{Key: mathJaxFormulaTextAttr, Val: formulaText},
	}
	if display {
		placeholder.Attr = append(placeholder.Attr, html.Attribute{Key: mathJaxBlockAttr, Val: "1"})
	}
	node.Parent.InsertBefore(placeholder, node)
	node.Parent.RemoveChild(node)
}

// extractKaTeXText 从 KaTeX 渲染节点提取近似的公式文本。
//
// KaTeX 的 .katex-html 子树每个符号都包在带语义 class 的 span 里（mord/mrel/mbin/mop 等），
// textContent 能得到近似可读的公式文本（如 "E = mc²"、"a² + b² = c²"）。这是 LLM 反推的精准输入。
// 排除 .katex-mathml 的内容（避免重复）。
func extractKaTeXText(node *html.Node) string {
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "span" {
			// 跳过 .katex-html 标签本身（它的文本在子节点里）和 .katex-mathml（无障碍层，文本重复）
			class := markdown.GetAttr(n, "class")
			if hasClass(class, "katex-mathml") {
				return
			}
		}
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(node)
	return strings.TrimSpace(buf.String())
}

// findAllByClass 在 node 子树里查找所有带指定 class 的指定标签元素。
func findAllByClass(root *html.Node, tag, class string) []*html.Node {
	var result []*html.Node
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == tag && hasClass(markdown.GetAttr(n, "class"), class) {
			result = append(result, n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)
	return result
}

// findMathJaxScripts 递归查找所有 <script type="math/tex"> 和 <script type="math/tex; mode=display">。
func findMathJaxScripts(n *html.Node) []*html.Node {
	var result []*html.Node
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode && node.Data == "script" {
			if isMathJaxScript(markdown.GetAttr(node, "type")) {
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

// Placeholder 描述一个待还原的公式占位。
//
// collectPlaceholders 收集后，LLM 阶段可读取 FormulaText 反推 LaTeX，
// 再用 finalizePlaceholders 按反推结果或兜底策略替换。
type Placeholder struct {
	Node        *html.Node
	IsBlock     bool   // true=块级（$$...$$），false=行内（$...$）
	Latex       string // 从 annotation 提取的源码（标准 KaTeX/MathJax 站点有值）
	FormulaText string // KaTeX DOM 的 textContent（如 "E = mc²"），LLM 反推的输入
}

// collectPlaceholders 遍历 article.Node，收集所有公式占位（mathjax-legacy span）。
//
// 返回的 Placeholder 列表顺序即占位在文中出现的顺序（DOM 遍历顺序）。
// Node 字段指向原始占位 span，调用方可用 setPlaceholderLatex 更新后再 finalizePlaceholders。
func collectPlaceholders(root *html.Node) []Placeholder {
	var result []Placeholder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "span" {
			class := markdown.GetAttr(n, "class")
			if hasClass(class, "mathjax-legacy") {
				result = append(result, Placeholder{
					Node:        n,
					IsBlock:     markdown.GetAttr(n, mathJaxBlockAttr) == "1",
					Latex:       markdown.GetAttr(n, mathJaxLatexAttr),
					FormulaText: markdown.GetAttr(n, mathJaxFormulaTextAttr),
				})
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)
	return result
}

// finalizePlaceholders 把所有占位替换成 LaTeX 文本。
//
// 替换规则：占位的 Latex 字段有值就用它，否则用空格占位（行内 $ $ / 块级 $$ $$）。
// 调用方可在 finalize 前用 SetPlaceholderLatex 注入 LLM 反推结果。
func finalizePlaceholders(placeholders []Placeholder) {
	for _, p := range placeholders {
		latex := p.Latex
		text := wrapLatex(latex, p.IsBlock)
		insertTextNode(p.Node, text)
	}
}

// SetPlaceholderLatex 更新占位的 Latex 字段并同步到 DOM data 属性。
// 供 LLM 阶段注入反推结果。
func SetPlaceholderLatex(p *Placeholder, latex string) {
	p.Latex = latex
	markdown.SetAttr(p.Node, mathJaxLatexAttr, latex)
}

// restoreMathNodes 遍历 article.Node，把所有公式占位（mathjax-legacy）与漏网的
// KaTeX 节点（.katex-display / .katex）替换成 LaTeX 文本。
//
// 这是「未启用 AI 还原」的兜底路径：有源码的还原真实 LaTeX，无源码的留空占位。
// 启用 AI 还原时调用方应走 collectPlaceholders + LLM + finalizePlaceholders 三步。
func restoreMathNodes(root *html.Node) {
	// 先收集占位（mathjax-legacy）
	placeholders := collectPlaceholders(root)
	// 再收集漏网的 KaTeX 节点（markBlock/markInline 未覆盖的边缘情况）
	var extraReplacements []nodeReplacement
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "span" {
			class := markdown.GetAttr(n, "class")
			if hasClass(class, "katex-display") {
				extraReplacements = append(extraReplacements, mathReplacementFromKaTeX(n, true))
				return
			} else if hasClass(class, "katex") {
				extraReplacements = append(extraReplacements, mathReplacementFromKaTeX(n, false))
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(root)

	// 用 finalizePlaceholders 处理占位
	finalizePlaceholders(placeholders)
	// 处理漏网 KaTeX
	for _, r := range extraReplacements {
		insertTextNode(r.target, r.text)
	}
}

type nodeReplacement struct {
	target *html.Node
	text   string
}

// mathReplacementFromKaTeX 把漏网的 KaTeX 节点还原成 LaTeX（兜底路径，正常不应命中）。
func mathReplacementFromKaTeX(katexSpan *html.Node, display bool) nodeReplacement {
	latex := findKatexAnnotation(katexSpan)
	text := wrapLatex(latex, display)
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
			if strings.EqualFold(markdown.GetAttr(n, "encoding"), "application/x-tex") {
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
