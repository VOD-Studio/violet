package post

import (
	"fmt"
	"strconv"
	"strings"

	md "github.com/JohannesKaufmann/html-to-markdown"
	"github.com/JohannesKaufmann/html-to-markdown/plugin"
	"github.com/PuerkitoBio/goquery"
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
		md.Rule{Filter: []string{"a"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if s.Is(`[role="doc-backlink"], [data-footnote-backref]`) {
				return md.String("")
			}
			if id := strings.TrimPrefix(s.AttrOr("href", ""), "#"); strings.HasPrefix(s.AttrOr("href", ""), "#") && footnotes[id] != "" {
				return md.String("[^" + footnotes[id] + "]")
			}
			return nil
		}},
		md.Rule{Filter: []string{"sup"}, Replacement: func(content string, s *goquery.Selection, _ *md.Options) *string {
			if strings.HasPrefix(content, "[^") {
				return md.String(content)
			}
			return nil
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
			if s.Find("[colspan], [rowspan], [data-colwidth], [style], [width]").Length() == 0 && len(s.Nodes[0].Attr) == 0 {
				return nil
			}
			original, err := goquery.OuterHtml(s)
			if err != nil {
				return nil
			}
			return md.String("\n\n" + original + "\n\n")
		}},
	)
	mdText, err := converter.ConvertString(htmlStr)
	if err != nil {
		return "", fmt.Errorf("HTML 转 Markdown 失败: %w", err)
	}
	return mdText, nil
}

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
