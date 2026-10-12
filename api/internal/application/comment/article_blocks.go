package comment

import (
	"fmt"
	"strings"
	"unicode/utf16"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"

	"blog-api/internal/application/markdown"
	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

// 与前端 extract-blocks.ts BLOCK_SELECTOR 一致。
const articleBlockSelector = "p, h2, h3, h4, h5, li, pre, blockquote, [data-runnable='true']"

// readerAllowedTags 对齐阅读端 sanitize-content.ts（hast-util-sanitize defaultSchema + 站点扩展）。
// 未列出的元素整棵丢弃，避免 ContentHTML 中的 script/style 等进入块文本而与浏览器可见 DOM 分叉。
var readerAllowedTags = map[string]struct{}{
	"a": {}, "abbr": {}, "b": {}, "blockquote": {}, "br": {}, "code": {},
	"dd": {}, "del": {}, "details": {}, "div": {}, "dl": {}, "dt": {},
	"em": {}, "figcaption": {}, "figure": {}, "h1": {}, "h2": {}, "h3": {},
	"h4": {}, "h5": {}, "h6": {}, "hr": {}, "i": {}, "img": {}, "input": {},
	"ins": {}, "kbd": {}, "label": {}, "li": {}, "mark": {}, "ol": {},
	"p": {}, "picture": {}, "pre": {}, "q": {}, "rp": {}, "rt": {},
	"ruby": {}, "s": {}, "samp": {}, "section": {}, "source": {}, "span": {},
	"strike": {}, "strong": {}, "sub": {}, "summary": {}, "sup": {},
	"table": {}, "tbody": {}, "td": {}, "tfoot": {}, "th": {}, "thead": {},
	"tr": {}, "tt": {}, "u": {}, "ul": {}, "var": {},
}

// ArticleBlock 正文中的一个可锚定块（id = SHA-256(TrimSpace(text))[:8]）。
type ArticleBlock struct {
	ID   string
	Text string // 对应 DOM textContent，供 offset 校验
}

// ExtractArticleBlocks 从文章 ContentHTML 提取候选块，对齐前端 extractCandidateBlocks；
// 块文本跳过阅读端 sanitize 会丢弃的标签子树（如 script），与可见 DOM 一致。
func ExtractArticleBlocks(contentHTML string) ([]ArticleBlock, error) {
	contentHTML = strings.TrimSpace(contentHTML)
	if contentHTML == "" {
		return nil, nil
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(contentHTML))
	if err != nil {
		return nil, shared.BadRequest("文章 HTML 无法解析")
	}
	var blocks []ArticleBlock
	doc.Find(articleBlockSelector).Each(func(_ int, sel *goquery.Selection) {
		n := sel.Get(0)
		text := nodeTextContent(n)
		id, err := ComputeBlockID(text)
		if err != nil {
			return
		}
		blocks = append(blocks, ArticleBlock{ID: id, Text: text})
	})
	return blocks, nil
}

func nodeTextContent(n *html.Node) string {
	if n == nil {
		return ""
	}
	// 可运行 pre：与 HtmlContent/CodeRunner 一致，data-source 为权威源码（非高亮子树）。
	if n.Type == html.ElementNode && n.Data == "pre" && attr(n, "data-runnable") == "true" {
		if src := attr(n, "data-source"); src != "" {
			return src
		}
	}
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node == nil {
			return
		}
		if node.Type == html.ElementNode {
			if _, ok := readerAllowedTags[node.Data]; !ok {
				return // 阅读端 sanitize 会整棵移除
			}
			switch attr(node, "data-type") {
			case "inline-math", "block-math":
				// 与阅读端 carrier 一致：用 data-latex 参与块文本（空 span 无子文本）。
				b.WriteString(attr(node, "data-latex"))
				return
			case "diagram-block":
				b.WriteString(attr(node, "data-source"))
				return
			}
			if node.Data == "pre" && attr(node, "data-runnable") == "true" {
				if src := attr(node, "data-source"); src != "" {
					b.WriteString(src)
					return
				}
			}
		}
		if node.Type == html.TextNode {
			b.WriteString(node.Data)
		}
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return b.String()
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}


// ResolveArticleHTML 锚点校验用正文 HTML：优先 ContentHTML；空且 ContentMD 非空时降级渲染
//（与阅读端 blog/$slug content_html 空则用 content_md 一致）。渲染失败返回空串。
func ResolveArticleHTML(contentHTML, contentMD string) string {
	if h := strings.TrimSpace(contentHTML); h != "" {
		return h
	}
	md := strings.TrimSpace(contentMD)
	if md == "" {
		return ""
	}
	generated, err := markdown.ToHTML(md)
	if err != nil || strings.TrimSpace(generated) == "" {
		return ""
	}
	return generated
}

// EnsureAnchorMatchesArticle 校验锚点 block_id 对应正文完整渲染块，并用该块全文重验 offset/selected_text。
func EnsureAnchorMatchesArticle(contentHTML string, anchor *domain.Anchor) error {
	if anchor == nil {
		return shared.BadRequest("缺少锚点")
	}
	blocks, err := ExtractArticleBlocks(contentHTML)
	if err != nil {
		return err
	}
	var canonical string
	found := false
	for _, b := range blocks {
		if b.ID == anchor.BlockID {
			canonical = b.Text
			found = true
			break
		}
	}
	if !found {
		return shared.BadRequest(fmt.Sprintf("block_id=%q 未匹配文章中任何完整渲染块", anchor.BlockID))
	}
	id, err := ComputeBlockID(canonical)
	if err != nil {
		return err
	}
	if anchor.BlockHashSync != "" && anchor.BlockHashSync != id {
		return shared.BadRequest(fmt.Sprintf("block_text_hash=%q 与文章块 %q 不一致", anchor.BlockHashSync, id))
	}
	units := utf16.Encode([]rune(canonical))
	if anchor.StartOffset < 0 || anchor.EndOffset <= anchor.StartOffset || anchor.EndOffset > len(units) {
		return shared.BadRequest(fmt.Sprintf(
			"offset 相对文章块越界：start=%d end=%d，块 UTF-16 长度=%d",
			anchor.StartOffset, anchor.EndOffset, len(units),
		))
	}
	got := string(utf16.Decode(units[anchor.StartOffset:anchor.EndOffset]))
	if got != anchor.SelectedText {
		return shared.BadRequest(fmt.Sprintf(
			"selected_text 与文章块[%d:%d]不一致：实际为 %q",
			anchor.StartOffset, anchor.EndOffset, got,
		))
	}
	return nil
}
