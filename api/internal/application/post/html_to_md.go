package post

import (
	"bytes"
	"fmt"

	"github.com/JohannesKaufmann/html-to-markdown/plugin"
	"golang.org/x/net/html"

	md "github.com/JohannesKaufmann/html-to-markdown"
)

// htmlToMarkdown 把 readability 输出的干净 HTML 转为 GFM Markdown。
//
// 与编辑器/阅读端共享同一套公式节点语义：
//   - 行内公式 <span data-type="inline-math" data-latex="..."> → $...$
//   - 块级公式 <div data-type="block-math" data-latex="...">  → $$...$$
//
// 实现策略：html-to-markdown 的 Rule.Filter 按 tag name 注册，无法用属性选择器
// 精确命中公式节点（用 span/div 会误伤其他节点）。故在转换前先用 net/html 走一遍
// DOM，把公式节点替换为纯文本占位（$...$ / $$...$$），让库的默认规则自然处理。
// 其余 GFM 元素（代码块/表格/链接/列表）走库的默认 + GFM plugin。
func htmlToMarkdown(htmlStr string) (string, error) {
	preprocessed, err := replaceMathNodesWithLatex(htmlStr)
	if err != nil {
		return "", fmt.Errorf("预处理公式节点失败: %w", err)
	}
	converter := md.NewConverter("", true, nil)
	converter.Use(plugin.GitHubFlavored())
	mdText, err := converter.ConvertString(preprocessed)
	if err != nil {
		return "", fmt.Errorf("HTML 转 Markdown 失败: %w", err)
	}
	return mdText, nil
}

// replaceMathNodesWithLatex 把公式占位节点替换为 LaTeX 文本节点：
// 行内 <span data-type="inline-math" data-latex="X"> → 文本 "$X$"
// 块级 <div data-type="block-math"  data-latex="X"> → 文本 "$$X$$"
//
// 走 net/html 遍历 DOM，命中即用文本节点替换整个元素。
func replaceMathNodesWithLatex(htmlStr string) (string, error) {
	doc, err := html.Parse(bytes.NewReader([]byte(htmlStr)))
	if err != nil {
		return "", err
	}
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		// 先处理子节点（替换会在遍历中改变结构，故预存 next）
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if n.Type != html.ElementNode {
			return
		}
		dt, hasDt := getMathAttr(n, "data-type")
		if !hasDt {
			return
		}
		if dt != "inline-math" && dt != "block-math" {
			return
		}
		latex, hasLatex := getMathAttr(n, "data-latex")
		if !hasLatex {
			return
		}
		var text string
		if dt == "block-math" {
			text = "$$" + latex + "$$"
		} else {
			text = "$" + latex + "$"
		}
		textNode := &html.Node{Type: html.TextNode, Data: text}
		n.Parent.InsertBefore(textNode, n)
		n.Parent.RemoveChild(n)
	}
	walk(doc)
	var buf bytes.Buffer
	if err := html.Render(&buf, doc); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func getMathAttr(n *html.Node, key string) (string, bool) {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val, true
		}
	}
	return "", false
}
