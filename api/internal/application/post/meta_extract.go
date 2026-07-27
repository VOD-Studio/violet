package post

import (
	"encoding/json"
	"strings"

	"golang.org/x/net/html"
)

// 文章元信息提取。
//
// readability 的 article.Title() 经常返回站点名（<title>SiteName</title> 或 og:title
// 被站点写成站点名），H1 又会被 readability 降级成 H2 甚至删除。所以在 readability
// 处理前的原始 doc 上自己提取，才能拿到正文真实标题。
//
// 标题优先级：og:title → JSON-LD(name/headline) → 正文首个 <h1> → <title> 兜底。
// SEO 标题：twitter:title → og:title（社交分享标题，可能与正文标题不同，独立字段）。
// SEO 描述：meta description → og:description → twitter:description。

// extractArticleTitle 从原始 doc 提取文章正文标题。
func extractArticleTitle(doc *html.Node) string {
	// 1. og:title
	if v := metaContent(doc, "property", "og:title"); v != "" {
		return v
	}
	// 2. JSON-LD name / headline
	if v := jsonLDString(doc, "name", "headline"); v != "" {
		return v
	}
	// 3. 正文首个 <h1>（readability 处理前 H1 还在）
	if h1 := firstTagText(doc, "h1"); h1 != "" {
		return h1
	}
	// 4. <title> 兜底
	if v := firstTagText(doc, "title"); v != "" {
		return v
	}
	return ""
}

// extractSeoTitle 从原始 doc 提取 SEO 标题（社交分享用，独立于正文标题）。
func extractSeoTitle(doc *html.Node) string {
	if v := metaContent(doc, "name", "twitter:title"); v != "" {
		return v
	}
	if v := metaContent(doc, "property", "og:title"); v != "" {
		return v
	}
	return ""
}

// extractSeoDescription 从原始 doc 提取 SEO 描述。
func extractSeoDescription(doc *html.Node) string {
	if v := metaContent(doc, "name", "description"); v != "" {
		return v
	}
	if v := metaContent(doc, "property", "og:description"); v != "" {
		return v
	}
	if v := metaContent(doc, "name", "twitter:description"); v != "" {
		return v
	}
	return ""
}

// metaContent 查找 <meta> 标签的 content 值，按 attr=key=val 匹配。
// 同时兼容 attr 在 property/name 两种位置的容错由调用方通过 key 指定。
func metaContent(doc *html.Node, attr, key string) string {
	var found string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if found != "" {
			return
		}
		if n.Type == html.ElementNode && n.Data == "meta" {
			if getAttr(n, attr) == key {
				found = strings.TrimSpace(getAttr(n, "content"))
				return
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return found
}

// jsonLDString 从 <script type="application/ld+json"> 里取指定字段（取第一个非空）。
// 兼容 Article/BlogPosting 类型里 name 或 headline 字段。
func jsonLDString(doc *html.Node, keys ...string) string {
	for _, script := range findScriptsByType(doc, "application/ld+json") {
		raw := textContent(script)
		if raw == "" {
			continue
		}
		// JSON-LD 可能是单个对象或数组；统一解成 []map 再遍历
		var asArray []map[string]any
		if err := json.Unmarshal([]byte(raw), &asArray); err == nil {
			for _, obj := range asArray {
				if v := pickString(obj, keys); v != "" {
					return v
				}
			}
			continue
		}
		var asObject map[string]any
		if err := json.Unmarshal([]byte(raw), &asObject); err == nil {
			if v := pickString(asObject, keys); v != "" {
				return v
			}
		}
	}
	return ""
}

// pickString 从 map 里按 keys 顺序取第一个非空字符串值。
func pickString(obj map[string]any, keys []string) string {
	for _, k := range keys {
		if v, ok := obj[k].(string); ok {
			if s := strings.TrimSpace(v); s != "" {
				return s
			}
		}
	}
	return ""
}

// findScriptsByType 查找所有 <script type="..."> 节点。
func findScriptsByType(doc *html.Node, targetType string) []*html.Node {
	var result []*html.Node
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "script" {
			if strings.EqualFold(getAttr(n, "type"), targetType) {
				result = append(result, n)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return result
}

// firstTagText 取文档里首个指定标签的纯文本（trim 后）。
func firstTagText(doc *html.Node, tag string) string {
	var found string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if found != "" {
			return
		}
		if n.Type == html.ElementNode && n.Data == tag {
			found = strings.TrimSpace(textContent(n))
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return found
}

// extractCanonicalURL 取文章的 canonical URL：
// 优先 og:url → 次 <link rel="canonical">。都缺时返回空串（调用方回退到输入 url）。
func extractCanonicalURL(doc *html.Node) string {
	if v := metaContent(doc, "property", "og:url"); v != "" {
		return v
	}
	var found string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if found != "" {
			return
		}
		if n.Type == html.ElementNode && n.Data == "link" {
			if strings.EqualFold(getAttr(n, "rel"), "canonical") {
				found = strings.TrimSpace(getAttr(n, "href"))
				return
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return found
}

// extractCoverImage 取封面图 URL：优先 og:image → 次 twitter:image。
func extractCoverImage(doc *html.Node) string {
	if v := metaContent(doc, "property", "og:image"); v != "" {
		return v
	}
	if v := metaContent(doc, "name", "twitter:image"); v != "" {
		return v
	}
	return ""
}
