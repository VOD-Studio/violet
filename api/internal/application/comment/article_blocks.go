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

// 新锚点能力边界（与前端 selection-to-anchor 的 BLOCK_SELECTOR + 不可批注容器选择器
// 各自维护同一契约，不共享字符串）。历史锚点的候选块由阅读端 extract-blocks 独立
// 提取（含 pre/data-runnable），不受此选择器限制。
const articleBlockSelector = "p, h1, h2, h3, h4, h5, h6, li, blockquote"

// ArticleBlock 正文中的一个可锚定块（id = SHA-256(TrimSpace(text))[:8]）。
type ArticleBlock struct {
	ID   string
	Text string // 规范块文本，供 offset 校验
}

// ExtractArticleBlocks 提取可创建新锚点的正文块：纯文本块 p/h1–h6/li/blockquote，
// 行内可含 code/a/行内公式（data-latex）；表格、图片块、figure/figcaption、块公式、
// 图块、pre/可运行块、嵌入卡与 details>summary 不返回。块文本跳过阅读端 sanitize
// 会丢弃的标签子树（如 script），与可见 DOM 一致。
func ExtractArticleBlocks(contentHTML string) ([]ArticleBlock, error) {
	contentHTML = strings.TrimSpace(contentHTML)
	if contentHTML == "" {
		return nil, nil
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(contentHTML))
	if err != nil {
		return nil, shared.BadRequest("文章 HTML 无法解析")
	}
	// 阅读端 strip 只移除 script 整树；其他不支持的标签会解包保留文本。
	doc.Find("script").Remove()
	var blocks []ArticleBlock
	doc.Find(articleBlockSelector).Each(func(_ int, sel *goquery.Selection) {
		n := sel.Get(0)
		if !annotatableArticleNode(n) {
			return
		}
		text := nodeTextContent(n)
		id, err := ComputeBlockID(text)
		if err != nil {
			return
		}
		blocks = append(blocks, ArticleBlock{ID: id, Text: text})
	})
	return blocks, nil
}

// 源 HTML 中的布局与代码载体不可形成新锚点；段落内仅含图片时无文本。
func annotatableArticleNode(n *html.Node) bool {
	for parent := n.Parent; parent != nil; parent = parent.Parent {
		if parent.Type != html.ElementNode {
			continue
		}
		if parent.Data == "table" || parent.Data == "figure" || parent.Data == "figcaption" ||
			parent.Data == "summary" || parent.Data == "pre" || parent.Data == "code" ||
			attr(parent, "data-type") == "block-math" || attr(parent, "data-type") == "diagram-block" {
			return false
		}
	}
	return !containsExcludedArticleNode(n)
}

func containsExcludedArticleNode(n *html.Node) bool {
	var visit func(*html.Node) bool
	visit = func(node *html.Node) bool {
		if node.Type == html.ElementNode {
			switch node.Data {
			case "table", "figure", "figcaption", "summary", "pre":
				return true
			}
			switch attr(node, "data-type") {
			case "block-math", "diagram-block":
				return true
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			if visit(child) {
				return true
			}
		}
		return false
	}
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		if visit(child) {
			return true
		}
	}
	return false
}

func nodeTextContent(n *html.Node) string {
	if n == nil {
		return ""
	}
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node == nil {
			return
		}
		if node.Type == html.ElementNode {
			if node.Data == "script" {
				return
			}
			// 行内公式 carrier：空 span 无子文本，与阅读端口径一致用 data-latex 计入。
			if attr(node, "data-type") == "inline-math" {
				b.WriteString(attr(node, "data-latex"))
				return
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
// （与阅读端 blog/$slug content_html 空则用 content_md 一致）。渲染失败返回空串。
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
