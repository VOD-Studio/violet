package post

import (
	"bytes"
	"fmt"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	gmhtml "github.com/yuin/goldmark/renderer/html"
	"golang.org/x/net/html"
)

// markdownToHTML 把 Markdown 转为 violet 编辑器 schema 兼容的 HTML。
//
// 用途：当上游（如 MCP create_post）只提供 content_md、缺少 content_html 时，
// 在应用层 service.Create/Update 兜底生成 content_html。编辑器与阅读端都以
// content_html 为权威源，缺失会导致编辑页无数据、预览格式全无。
//
// 实现选型（2026 Go 生态最佳实践）：
//   - goldmark（CommonMark 0.31.2 合规，Hugo 等事实标准）+ GFM 扩展
//     （表格 / 删除线 / 任务列表 / autolink）作基础渲染。
//   - violet 把公式 / mermaid / 任务列表的语义编码进私有 data-* carrier，没有
//     标准 Markdown 语法能被 goldmark 直接产成，故用 net/html 后处理重写为三类
//     carrier（与 html_to_md.go 的 replaceMathNodesWithLatex 同款手法，保持一致）：
//     1) 行内公式 $...$ → <span data-type="inline-math" data-latex="...">
//        块级公式 $$...$$ → <div data-type="block-math" data-latex="...">
//     2) ```mermaid 围栏 → <div data-type="diagram-block" data-format="mermaid" data-source="...">
//     3) GFM 任务列表 <ul><li><input ...> → <ul data-type="taskList">
//        <li data-type="taskItem" data-checked="true|false">
//
// 公式 / mermaid 采用「预处理占位 + 渲染后还原」：先在 Markdown 源里把它们换
// 成纯文本占位，让 goldmark 当普通段落/代码块渲染，再用 net/html 把占位节点
// 整体替换成 carrier。避免写 goldmark 自定义 inline/block parser，降低复杂度。
//
// 不做的事：代码高亮交给阅读端 CodeBlock（lowlight），这里只产
// <pre><code class="language-x">；不做 chroma 服务端高亮。
func markdownToHTML(mdStr string) (string, error) {
	if strings.TrimSpace(mdStr) == "" {
		return "", nil
	}
	// 1) 提取公式与 mermaid 块，替换成占位，记录原始内容。
	extracted, placeholders := extractSpecial(mdStr)

	// 2) goldmark GFM 渲染。
	converter := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		// 原样透传 raw HTML（如 <br>），转义/消毒由阅读端 hast 白名单兜底。
		goldmark.WithRendererOptions(gmhtml.WithUnsafe()),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
	)
	var buf bytes.Buffer
	if err := converter.Convert([]byte(extracted), &buf); err != nil {
		return "", fmt.Errorf("markdown 转 HTML 失败: %w", err)
	}
	rendered := buf.String()

	// 3) net/html 后处理：占位还原为 carrier + 任务列表重写。
	final, err := rewriteCarriers(rendered, placeholders)
	if err != nil {
		return "", fmt.Errorf("carrier 重写失败: %w", err)
	}
	return final, nil
}

// placeholder 记录一处特殊块（公式 / mermaid）的原始内容，待渲染后还原。
type placeholder struct {
	kind string // "inline-math" | "block-math" | "mermaid"
	body string // 公式 LaTeX 或 mermaid 源码
}

// 占位标记形如  VIOLETPH-<kind>-<n>，独占一段（块级）或嵌在文本流（行内）。
const phPrefix = "VIOLETPH"

// extractSpecial 把 mermaid 围栏 / 块级公式 / 行内公式从 Markdown 源里提取出来，
// 替换为占位标记。返回替换后的 Markdown 与占位表（按下标顺序）。
//
// 顺序：先 mermaid 围栏（多行扫描），再块级公式 $$...$$，最后行内公式 $...$。
func extractSpecial(mdStr string) (string, []placeholder) {
	var phs []placeholder
	out := mdStr

	// mermaid 围栏：按行扫描，支持多段
	out = replaceMermaidFences(out, func(body string) string {
		idx := len(phs)
		phs = append(phs, placeholder{kind: "mermaid", body: body})
		return phLine("mermaid", idx)
	})

	// 块级公式 $$...$$（非贪婪，可跨行）
	blockMathRe := regexp.MustCompile(`\$\$([\s\S]+?)\$\$`)
	out = blockMathRe.ReplaceAllStringFunc(out, func(m string) string {
		body := blockMathRe.FindStringSubmatch(m)[1]
		idx := len(phs)
		phs = append(phs, placeholder{kind: "block-math", body: strings.TrimSpace(body)})
		// 独占段落，确保 goldmark 渲染成独立 <p>，便于后续整段替换
		return "\n\n" + phLine("block-math", idx) + "\n\n"
	})

	// 行内公式 $...$（不跨行，内容不含 $）
	inlineMathRe := regexp.MustCompile(`\$([^$\n]+?)\$`)
	out = inlineMathRe.ReplaceAllStringFunc(out, func(m string) string {
		body := inlineMathRe.FindStringSubmatch(m)[1]
		if !looksLikeLatex(body) {
			return m // 非公式（如美元金额），原样保留
		}
		idx := len(phs)
		phs = append(phs, placeholder{kind: "inline-math", body: strings.TrimSpace(body)})
		return phInline("inline-math", idx)
	})

	return out, phs
}

// replaceMermaidFences 按行扫描，把每段 ```mermaid ... ``` 替换为 fn(body)。
func replaceMermaidFences(src string, fn func(body string) string) string {
	lines := strings.Split(src, "\n")
	var out []string
	i := 0
	for i < len(lines) {
		if strings.HasPrefix(strings.TrimSpace(lines[i]), "```mermaid") {
			var body []string
			j := i + 1
			closed := false
			for ; j < len(lines); j++ {
				if strings.TrimSpace(lines[j]) == "```" {
					closed = true
					break
				}
				body = append(body, lines[j])
			}
			if closed {
				out = append(out, fn(strings.Join(body, "\n")))
				i = j + 1
				continue
			}
		}
		out = append(out, lines[i])
		i++
	}
	return strings.Join(out, "\n")
}

// looksLikeLatex 粗判一段 $...$ 内容是否为公式（含 LaTeX 命令、上下标、运算等）。
// 否则当作普通美元金额保留，避免误伤。
func looksLikeLatex(s string) bool {
	if s == "" {
		return false
	}
	return strings.ContainsAny(s, `\^_=+{}`) ||
		regexp.MustCompile(`\d\s*[+\-*/^]\s*\d`).MatchString(s)
}

// phLine / phInline 构造占位标记。块级独占一段，行内嵌入文本流。
func phLine(kind string, idx int) string  { return fmt.Sprintf("%s-%s-%d", phPrefix, kind, idx) }
func phInline(kind string, idx int) string { return phLine(kind, idx) }

// phRe 匹配占位标记，捕获 kind 与 idx。
var phRe = regexp.MustCompile(phPrefix + `-(inline-math|block-math|mermaid)-(\d+)`)

// rewriteCarriers 用 net/html 遍历 DOM：
//   - 占位标记（在 TextNode 里）→ 替换为对应 carrier 元素节点；
//   - 块级占位独占 <p> 时 → 用 <div> 替换整个 <p>（p 不能含 div）；
//   - 含 checkbox <input> 的 <ul><li> → 标记为 taskList / taskItem carrier。
//
// 只渲染 <body> 子节点片段（逐个 Render 拼接），避免 html.Parse 产出的
// <html><head></head><body>…</body></html> 外壳进入 content_html。
func rewriteCarriers(renderedHTML string, phs []placeholder) (string, error) {
	doc, err := html.Parse(strings.NewReader(renderedHTML))
	if err != nil {
		return "", err
	}
	rewritePlaceholders(doc, phs)
	rewriteTaskLists(doc)
	body := findBody(doc)
	var buf bytes.Buffer
	if body != nil {
		for c := body.FirstChild; c != nil; c = c.NextSibling {
			if err := html.Render(&buf, c); err != nil {
				return "", err
			}
		}
	} else {
		if err := html.Render(&buf, doc); err != nil {
			return "", err
		}
	}
	return buf.String(), nil
}

// findBody 定位 <body> 节点（html.Parse 产出的完整文档树里唯一一个）。
func findBody(n *html.Node) *html.Node {
	if n.Type == html.ElementNode && n.Data == "body" {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if found := findBody(c); found != nil {
			return found
		}
	}
	return nil
}

// rewritePlaceholders 遍历所有 TextNode，把占位标记替换成 carrier 元素。
//
// 一个 TextNode 可能含多个占位（或前后夹文本），逐个切分重建。
// 块级占位（block-math / mermaid）若独占一个 <p>，会把整个 <p> 替换为 <div> carrier，
// 避免 <div> 嵌入 <p> 的非法结构。
func rewritePlaceholders(root *html.Node, phs []placeholder) {
	// 先收集所有含占位的 TextNode（替换会改结构，故先快照）
	var targets []*html.Node
	var visitCollect func(*html.Node)
	visitCollect = func(n *html.Node) {
		if n.Type == html.TextNode && phRe.MatchString(n.Data) {
			targets = append(targets, n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			visitCollect(c)
		}
	}
	visitCollect(root)

	for _, node := range targets {
		pieces := phRe.Split(node.Data, -1)
		matches := phRe.FindAllStringSubmatch(node.Data, -1)
		if len(matches) == 0 {
			continue
		}
		// 仅一个占位且独占该 TextNode（前后无文本）：尝试整段替换其块级父 <p>
		solo := len(matches) == 1 && pieces[0] == "" && (len(pieces) < 2 || pieces[1] == "")
		if solo {
			if replaced := replaceSoloBlockPlaceholder(node, matches[0], phs); replaced {
				continue
			}
		}
		// 通用：在原 TextNode 位置依次插入 文本/carrier/文本/...
		parent := node.Parent
		insertBefore := node
		for i := 0; i < len(matches); i++ {
			if pieces[i] != "" {
				parent.InsertBefore(textNode(pieces[i]), insertBefore)
			}
			carrier := carrierNode(matches[i][1], phIdx(matches[i][2]), phs)
			if carrier != nil {
				parent.InsertBefore(carrier, insertBefore)
			}
			if i+1 < len(pieces) && pieces[i+1] != "" {
				parent.InsertBefore(textNode(pieces[i+1]), insertBefore)
			}
		}
		parent.RemoveChild(node)
	}
}

// replaceSoloBlockPlaceholder 处理「块级占位独占一个 <p>」的情形：
// 用 carrier <div> 替换整个 <p>，保持块级结构合法。
// 仅 block-math / mermaid 触发；inline-math 返回 false 走通用路径。
// 若 TextNode 的父不是 <p>（如 <li> 内），也返回 false。
func replaceSoloBlockPlaceholder(textNode *html.Node, m []string, phs []placeholder) bool {
	kind := m[1]
	if kind != "block-math" && kind != "mermaid" {
		return false
	}
	p := textNode.Parent
	if p == nil || p.Type != html.ElementNode || p.Data != "p" {
		return false
	}
	carrier := carrierNode(kind, phIdx(m[2]), phs)
	if carrier == nil {
		return false
	}
	p.Parent.InsertBefore(carrier, p)
	p.Parent.RemoveChild(p)
	return true
}

// carrierNode 按 kind + idx 从占位表构造 carrier 元素。idx 越界返回 nil（保留原占位文本）。
func carrierNode(kind string, idx int, phs []placeholder) *html.Node {
	if idx < 0 || idx >= len(phs) {
		return nil
	}
	body := phs[idx].body
	switch kind {
	case "inline-math":
		n := elNode("span")
		setAttr(n, "data-type", "inline-math")
		setAttr(n, "data-latex", body)
		return n
	case "block-math":
		n := elNode("div")
		setAttr(n, "data-type", "block-math")
		setAttr(n, "data-latex", body)
		return n
	case "mermaid":
		n := elNode("div")
		setAttr(n, "data-type", "diagram-block")
		setAttr(n, "data-format", "mermaid")
		setAttr(n, "data-source", body)
		return n
	}
	return nil
}

// rewriteTaskLists 把 goldmark GFM 任务列表重写为 violet carrier：
//
//	<ul data-type="taskList"><li data-type="taskItem" data-checked="true|false">…</li></ul>
//
// 触发：<ul> 至少一个 <li> 的首个元素子节点是 checkbox <input>。普通列表不动。
func rewriteTaskLists(root *html.Node) {
	var targets []*html.Node
	var visit func(*html.Node)
	visit = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "ul" && ulHasCheckbox(n) {
			targets = append(targets, n)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			visit(c)
		}
	}
	visit(root)

	for _, ul := range targets {
		setAttr(ul, "data-type", "taskList")
		for li := ul.FirstChild; li != nil; li = li.NextSibling {
			if li.Type != html.ElementNode || li.Data != "li" {
				continue
			}
			checked, input := liCheckboxState(li)
			setAttr(li, "data-type", "taskItem")
			setAttr(li, "data-checked", checked)
			if input != nil {
				li.RemoveChild(input) // 语义已进 data-checked，移除冗余 checkbox
			}
		}
	}
}

// ulHasCheckbox 判断 <ul> 的任一 <li> 首个元素子节点是否为 checkbox <input>。
func ulHasCheckbox(ul *html.Node) bool {
	for li := ul.FirstChild; li != nil; li = li.NextSibling {
		if li.Type != html.ElementNode || li.Data != "li" {
			continue
		}
		if _, input := liCheckboxState(li); input != nil {
			return true
		}
	}
	return false
}

// liCheckboxState 取 <li> 的首个元素子节点；若为 <input type="checkbox"> 返回
// checked 字符串与该 input 节点（供移除）。否则返回 ("false", nil)。
func liCheckboxState(li *html.Node) (string, *html.Node) {
	for c := li.FirstChild; c != nil; c = c.NextSibling {
		if c.Type != html.ElementNode {
			continue
		}
		if c.Data == "input" && getAttr(c, "type") == "checkbox" {
			checked := "false"
			if hasAttr(c, "checked") {
				checked = "true"
			}
			return checked, c
		}
		break // 首个元素子节点非 checkbox，视为普通列表项
	}
	return "false", nil
}

// hasAttr 判断元素是否声明了某属性（不关心值，如 <input checked>）。
func hasAttr(n *html.Node, key string) bool {
	for _, a := range n.Attr {
		if a.Key == key {
			return true
		}
	}
	return false
}

// --- net/html 节点构造小工具 ---

func elNode(tag string) *html.Node {
	return &html.Node{Type: html.ElementNode, Data: tag}
}

func textNode(data string) *html.Node {
	return &html.Node{Type: html.TextNode, Data: data}
}

func phIdx(s string) int {
	var idx int
	_, _ = fmt.Sscanf(s, "%d", &idx)
	return idx
}

// ensureContentHTML 在 content_html 缺失而 content_md 有值时，兜底用 md 生成
// 编辑器兼容的 HTML 写回 *html（原地更新）。
//
// 触发条件：contentHTML == "" && contentMD != ""。这精准命中 MCP 路径（只传 md）
// 而不误伤：
//   - admin REST 路径：编辑器恒同时产 html（getHTML），html 非空，不触发；
//   - 仅改 title/tags 的更新：md 与 html 都为空，不触发，保留已有正文不动；
//   - 显式清空正文（md="" 且 html=""）：不触发，保持空。
//
// 生成失败不阻塞主流程：兜底是尽力而为，失败时 content_html 留空，阅读端会降级
// 用 content_md 渲染（比抛错让创建失败更友好）。
func ensureContentHTML(contentHTML *string, contentMD string) {
	if contentHTML == nil || *contentHTML != "" || strings.TrimSpace(contentMD) == "" {
		return
	}
	generated, err := markdownToHTML(contentMD)
	if err != nil || generated == "" {
		return
	}
	*contentHTML = generated
}
