package post

import (
	"fmt"
	"strconv"
	"strings"

	md "github.com/JohannesKaufmann/html-to-markdown"
	"github.com/JohannesKaufmann/html-to-markdown/plugin"
	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

// 按 carrier 属性转换，避免公式和源码被当作普通正文转义。
// Goldmark、remark 与编辑器的脚注统一重新编号，保留重复引用关系与多段正文。
func htmlToMarkdown(htmlStr string) (string, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlStr))
	if err != nil {
		return "", fmt.Errorf("解析 HTML 失败: %w", err)
	}
	const endnotes = `[role="doc-endnotes"], [data-footnotes], .footnotes`
	footnotes := map[string]string{}
	doc.Find(endnotes).Find("li[id]").Each(func(_ int, item *goquery.Selection) {
		id, _ := item.Attr("id")
		if _, exists := footnotes[id]; !exists {
			footnotes[id] = strconv.Itoa(len(footnotes) + 1)
		}
	})
	// 转换器会向链接和列表添加内部属性，先保留原始载体。
	rawCarriers := make(map[*html.Node]string)
	var carrierErr error
	preserveDocument := false
	doc.Find("details, sub, sup, table").EachWithBreak(func(_ int, s *goquery.Selection) bool {
		tag := goquery.NodeName(s)
		if isFootnoteSup(s, footnotes) || (tag == "table" && !requiresHTMLTable(s)) {
			return true
		}
		if len(footnotes) > 0 {
			s.Find("a[href]").EachWithBreak(func(_ int, link *goquery.Selection) bool {
				href := link.AttrOr("href", "")
				preserveDocument = strings.HasPrefix(href, "#") && footnotes[strings.TrimPrefix(href, "#")] != ""
				return !preserveDocument
			})
			if preserveDocument {
				return false
			}
		}
		original, err := goquery.OuterHtml(s)
		if err != nil {
			carrierErr = err
			return false
		}
		if tag == "sub" || tag == "sup" {
			original = escapeInlineHTMLText(original)
		}
		// 编码换行，避免 CommonMark 在代码空行处截断 HTML 块。
		rawCarriers[s.Nodes[0]] = strings.ReplaceAll(original, "\n", "&#10;")
		return true
	})
	if carrierErr != nil {
		return "", fmt.Errorf("保留 HTML carrier 失败: %w", carrierErr)
	}
	if preserveDocument {
		// HTML 载体内的引用不能触发 Markdown 定义；整篇保留同一套引用与回链 ID。
		return strings.ReplaceAll(htmlStr, "\n", "&#10;"), nil
	}
	converter := md.NewConverter("", true, nil)
	converter.Use(plugin.GitHubFlavored())
	converter.AddRules(
		md.Rule{Filter: []string{"span", "div"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			switch s.AttrOr("data-type", "") {
			case "inline-math":
				if latex, ok := s.Attr("data-latex"); ok {
					return md.String("$" + latex + "$")
				}
			case "block-math":
				if latex, ok := s.Attr("data-latex"); ok {
					return md.String("\n\n$$\n" + latex + "\n$$\n\n")
				}
			case "diagram-block":
				if source, ok := s.Attr("data-source"); ok {
					return md.String(markdownFence(s.AttrOr("data-format", "mermaid"), source))
				}
			}
			return nil
		}},
		md.Rule{Filter: []string{"pre"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			code := s.Find("code").First()
			info := s.AttrOr("data-lang", "")
			if info == "" {
				for _, class := range strings.Fields(code.AttrOr("class", "")) {
					if strings.HasPrefix(class, "language-") {
						info = strings.TrimPrefix(class, "language-")
						break
					}
				}
			}
			source, hasSource := s.Attr("data-source")
			if !hasSource {
				source = strings.TrimSuffix(s.Text(), "\n")
			}
			if s.AttrOr("data-runnable", "") == "true" {
				info += " runnable"
				if overrides := s.AttrOr("data-overrides", ""); overrides != "" {
					info += " " + overrides
				}
			}
			return md.String(markdownFence(info, source))
		}},
		md.Rule{Filter: []string{"mark"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			return md.String("==" + content + "==")
		}},
		md.Rule{Filter: []string{"blockquote"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if s.AttrOr("data-type", "") != "alert" {
				return nil
			}
			kind := s.AttrOr("data-alert-type", "")
			switch kind {
			case "NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION":
				body := strings.TrimSpace(content)
				if body != "" {
					body = "\n> " + strings.ReplaceAll(body, "\n", "\n> ")
				}
				return md.String("\n\n> [!" + kind + "]" + body + "\n\n")
			default:
				return nil
			}
		}},
		md.Rule{Filter: []string{"details"}, Replacement: func(_ string, s *goquery.Selection, _ *md.Options) *string {
			return md.String("\n\n" + rawCarriers[s.Nodes[0]] + "\n\n")
		}},
		md.Rule{Filter: []string{"a"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if s.Is(`[role="doc-backlink"], [data-footnote-backref]`) {
				return md.String("")
			}
			if id := strings.TrimPrefix(s.AttrOr("href", ""), "#"); strings.HasPrefix(s.AttrOr("href", ""), "#") && footnotes[id] != "" {
				return md.String("[^" + footnotes[id] + "]")
			}
			return nil
		}},
		md.Rule{Filter: []string{"sub", "sup"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if isFootnoteSup(s, footnotes) {
				return md.String(content)
			}
			return md.String(rawCarriers[s.Nodes[0]])
		}},
		md.Rule{Filter: []string{"li"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if label := footnotes[s.AttrOr("id", "")]; label != "" {
				return md.String("\n\n[^" + label + "]: " + indentMarkdown(strings.TrimSpace(content)) + "\n\n")
			}
			if s.AttrOr("data-type", "") == "taskItem" {
				checked := " "
				if s.AttrOr("data-checked", "") == "true" {
					checked = "x"
				}
				return md.String("\n- [" + checked + "] " + indentMarkdown(strings.TrimSpace(content)) + "\n")
			}
			return nil
		}},
		md.Rule{Filter: []string{"ol"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if s.ParentsFiltered(endnotes).Length() > 0 && s.ChildrenFiltered("li[id]").Length() > 0 {
				return md.String(content)
			}
			return nil
		}},
		md.Rule{Filter: []string{"hr", "h2"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if s.ParentsFiltered(endnotes).Length() > 0 && s.ParentsFiltered("li").Length() == 0 {
				return md.String("")
			}
			return nil
		}},
		md.Rule{Filter: []string{"div", "section"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if !s.Is(endnotes) {
				return nil
			}
			return md.String("\n\n" + strings.TrimSpace(content) + "\n\n")
		}},
		md.Rule{Filter: []string{"table"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if original, ok := rawCarriers[s.Nodes[0]]; ok {
				return md.String("\n\n" + original + "\n\n")
			}
			return nil
		}},
	)
	mdText := converter.Convert(doc.Selection)
	return mdText, nil
}

func isFootnoteSup(s *goquery.Selection, footnotes map[string]string) bool {
	if goquery.NodeName(s) != "sup" || s.Children().Length() != 1 {
		return false
	}
	link := s.ChildrenFiltered("a")
	href := link.AttrOr("href", "")
	return strings.HasPrefix(href, "#") && footnotes[strings.TrimPrefix(href, "#")] != "" && strings.TrimSpace(s.Text()) == strings.TrimSpace(link.Text())
}

func requiresHTMLTable(s *goquery.Selection) bool {
	return len(s.Nodes[0].Attr) > 0 || s.Find("[colspan], [rowspan], [data-colwidth], [style], [width]").Length() > 0
}

// 行内 HTML 标签之间仍会解析 Markdown，字面标点须保留为字符实体。
func escapeInlineHTMLText(source string) string {
	tokenizer := html.NewTokenizer(strings.NewReader(source))
	var result strings.Builder
	for {
		kind := tokenizer.Next()
		if kind == html.ErrorToken {
			return result.String()
		}
		if kind == html.TextToken {
			_, _ = inlineHTMLTextEscapes.WriteString(&result, string(tokenizer.Raw()))
		} else {
			_, _ = result.Write(tokenizer.Raw())
		}
	}
}

var inlineHTMLTextEscapes = strings.NewReplacer(
	"\\", "&#92;", "`", "&#96;", "*", "&#42;", "_", "&#95;",
	"[", "&#91;", "]", "&#93;", "~", "&#126;", "$", "&#36;", "=", "&#61;",
)

func indentMarkdown(content string) string {
	return strings.ReplaceAll(content, "\n", "\n    ")
}

// 围栏必须长于源码中的所有连续反引号，防止代码示例提前闭合。
// 源码保持原样，列表与引用的缩进由对应转换规则补齐。
func markdownFence(info, source string) string {
	length, run := 3, 0
	for _, c := range source {
		if c == '`' {
			run++
			if run >= length {
				length = run + 1
			}
		} else {
			run = 0
		}
	}
	fence := strings.Repeat("`", length)
	return "\n\n" + fence + info + "\n" + source + "\n" + fence + "\n\n"
}
