// Package markdown 提供 Markdown → violet 编辑器 carrier HTML 的渲染管线，
// 以及 carrier 重写共用的 net/html DOM 助手。
package markdown

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	gmhtml "github.com/yuin/goldmark/renderer/html"
	"golang.org/x/net/html"
)

// ToHTML 把 Markdown 转为 violet 编辑器 schema 兼容的 HTML。
//
// 用途：当上游（如 MCP create_post）只提供 content_md、缺少 content_html 时，
// 在应用层 service.Create/Update 兜底生成 content_html。编辑器与阅读端都以
// content_html 为权威源，缺失会导致编辑页无数据、预览格式全无。
//
// Goldmark 先解析 Markdown 语境，公式、高亮与围栏 carrier 由扩展渲染，
// 因此代码示例中的特殊语法不会被提前替换。DOM 后处理只规范任务列表。
func ToHTML(mdStr string) (string, error) {
	if strings.TrimSpace(mdStr) == "" {
		return "", nil
	}
	converter := goldmark.New(
		goldmark.WithExtensions(extension.GFM, extension.Footnote, carrierExtension{}),
		// 原样透传 raw HTML（如 <br>），转义/消毒由阅读端 hast 白名单兜底。
		goldmark.WithRendererOptions(gmhtml.WithUnsafe()),
		goldmark.WithParserOptions(parser.WithAutoHeadingID()),
	)
	var buf bytes.Buffer
	if err := converter.Convert([]byte(mdStr), &buf); err != nil {
		return "", fmt.Errorf("markdown 转 HTML 失败: %w", err)
	}
	rendered := buf.String()

	final, err := rewriteCarriers(rendered)
	if err != nil {
		return "", fmt.Errorf("carrier 重写失败: %w", err)
	}
	return final, nil
}

// rewriteCarriers 规范任务列表并返回 body 片段，不改变 raw HTML 属性。
func rewriteCarriers(renderedHTML string) (string, error) {
	doc, err := html.Parse(strings.NewReader(renderedHTML))
	if err != nil {
		return "", err
	}
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
		SetAttr(ul, "data-type", "taskList")
		for li := ul.FirstChild; li != nil; li = li.NextSibling {
			if li.Type != html.ElementNode || li.Data != "li" {
				continue
			}
			checked, input := liCheckboxState(li)
			SetAttr(li, "data-type", "taskItem")
			SetAttr(li, "data-checked", checked)
			if input != nil {
				input.Parent.RemoveChild(input) // loose list 的 checkbox 位于首个 p 内。
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
		if c.Data == "p" {
			return liCheckboxState(c)
		}
		if c.Data == "input" && GetAttr(c, "type") == "checkbox" {
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

// GetAttr 读元素的属性值，不存在返回空串。
//
// 与 SetAttr 同理：markdown→html 与 html→md 两个方向的 carrier 重写共用。
func GetAttr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

// SetAttr 设置元素的属性（已有则更新，没有则追加）。
//
// 从 post 包迁出后导出：violet 的 HTML carrier 重写（markdown→html 与
// html→md 两个方向）共用同一 DOM 助手，单一真相。
func SetAttr(n *html.Node, key, val string) {
	for i, a := range n.Attr {
		if a.Key == key {
			n.Attr[i].Val = val
			return
		}
	}
	n.Attr = append(n.Attr, html.Attribute{Key: key, Val: val})
}

// EnsureHTML 在 content_html 缺失而 content_md 有值时，兜底用 md 生成
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
func EnsureHTML(contentHTML *string, contentMD string) {
	if contentHTML == nil || *contentHTML != "" || strings.TrimSpace(contentMD) == "" {
		return
	}
	generated, err := ToHTML(contentMD)
	if err != nil || generated == "" {
		return
	}
	*contentHTML = generated
}
