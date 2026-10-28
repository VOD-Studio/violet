// Package linkpreview 提供 OG 链接卡片的基础设施实现：
// HTML 安全抓取、meta 解析与封面下载。
//
// 抓取统一走 ssrf 安全传输层（私网拦截 + DNS 重绑定防护），
// 协议白名单、响应上限与超时在此收敛，应用层不感知传输细节。
package linkpreview

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"

	applp "blog-api/internal/application/linkpreview"
	"blog-api/internal/infrastructure/ssrf"
)

const (
	// maxHTMLBytes 单页 HTML 响应上限（OG meta 远小于此，防巨型响应）。
	maxHTMLBytes int64 = 2 << 20
	// fetchTimeout 单次页面抓取超时（含重定向）。
	fetchTimeout = 6 * time.Second
	// maxRedirects 重定向上限，每次仍经 SafeTransport 的连接级校验。
	maxRedirects = 5
)

// FetchError 分类抓取失败原因，供应用层记录脱敏摘要。
// 携带目标 URL 的细节只进日志，不进用户可见错误。
type FetchError struct {
	Reason string
	Err    error
}

func (e *FetchError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("linkpreview: %s: %v", e.Reason, e.Err)
	}
	return fmt.Sprintf("linkpreview: %s", e.Reason)
}

// PageMeta 抓取端口返回契约（应用层定义，此处的类型别名让实现与端口同型）。
type PageMeta = applp.FetchResult

// Fetcher 抓取页面并解析 OG 元数据。
type Fetcher struct {
	client *http.Client
}

// NewFetcher 构造抓取器。
//
// client 为 nil（生产）时使用 SSRF 安全传输；注入带 Transport 的 client
// 仅用于测试（httptest 监听环回，SafeTransport 会拦截）。
func NewFetcher(client *http.Client) *Fetcher {
	c := http.Client{}
	if client != nil {
		c = *client
	}
	if c.Transport == nil {
		c.Transport = ssrf.NewSafeTransport()
	}
	c.Timeout = fetchTimeout
	c.CheckRedirect = redirectPolicy
	return &Fetcher{client: &c}
}

func redirectPolicy(req *http.Request, via []*http.Request) error {
	if len(via) >= maxRedirects {
		return errors.New("too many redirects")
	}
	// 每跳复检协议白名单（SafeTransport 已在连接层拦截私网）。
	if _, err := validateTarget(req.URL.String()); err != nil {
		return err
	}
	return nil
}

func validateTarget(raw string) (*url.URL, error) {
	target, err := ssrf.ValidateURL(raw)
	if err != nil {
		return nil, err
	}
	if target.User != nil {
		return nil, errors.New("userinfo is not allowed")
	}
	if port := target.Port(); port != "" {
		value, err := strconv.Atoi(port)
		if err != nil || value < 1 || value > 65535 {
			return nil, errors.New("invalid port")
		}
	}
	return target, nil
}

// Fetch 抓取 url 并解析 meta。仅接受 HTML 响应。
func (f *Fetcher) Fetch(ctx context.Context, rawURL string) (PageMeta, error) {
	parsed, err := validateTarget(rawURL)
	if err != nil {
		return PageMeta{}, &FetchError{Reason: "url rejected", Err: err}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return PageMeta{}, &FetchError{Reason: "build request", Err: err}
	}
	// 明示抓取身份，不伪装浏览器。
	req.Header.Set("User-Agent", "Violet-LinkPreview/1.0 (+https://xunrua.top)")
	req.Header.Set("Accept", "text/html")

	res, err := f.client.Do(req)
	if err != nil {
		return PageMeta{}, &FetchError{Reason: "request", Err: err}
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return PageMeta{}, &FetchError{Reason: fmt.Sprintf("status %d", res.StatusCode)}
	}
	if media, _, perr := mime.ParseMediaType(res.Header.Get("Content-Type")); perr != nil || media != "text/html" {
		return PageMeta{}, &FetchError{Reason: "not html"}
	}

	body, err := io.ReadAll(ssrf.LimitBody(res.Body, maxHTMLBytes))
	if err != nil {
		return PageMeta{}, &FetchError{Reason: "read body", Err: err}
	}
	meta, err := parseMeta(body)
	if err != nil {
		return PageMeta{}, &FetchError{Reason: "parse html", Err: err}
	}
	meta.PageURL = res.Request.URL.String()
	return meta, nil
}

// parseMeta 从 HTML 提取 og/twitter meta 与 <title>。
func parseMeta(body []byte) (PageMeta, error) {
	root, err := html.Parse(bytes.NewReader(body))
	if err != nil {
		return PageMeta{}, err
	}
	var m PageMeta
	var ogTitle, twitterTitle, htmlTitle string
	var ogDesc, twitterDesc, nameDesc string
	var ogImage, twitterImage string

	for node := range iterNodes(root) {
		if node.Type != html.ElementNode {
			continue
		}
		switch node.Data {
		case "title":
			if htmlTitle == "" {
				htmlTitle = nodeText(node)
			}
		case "meta":
			name, prop, content := metaAttrs(node)
			switch {
			case prop == "og:title":
				setFirst(&ogTitle, content)
			case prop == "og:description":
				setFirst(&ogDesc, content)
			case prop == "og:site_name":
				setFirst(&m.SiteName, content)
			case prop == "og:image" || prop == "og:image:url" || prop == "og:image:secure_url":
				// 宽高等 og:image:* 属性不是图片地址。
				setFirst(&ogImage, content)
			case name == "twitter:title" || prop == "twitter:title":
				setFirst(&twitterTitle, content)
			case name == "twitter:description" || prop == "twitter:description":
				setFirst(&twitterDesc, content)
			case name == "twitter:image" || prop == "twitter:image":
				setFirst(&twitterImage, content)
			case name == "description":
				setFirst(&nameDesc, content)
			}
		}
	}

	m.Title = firstNonEmpty(ogTitle, twitterTitle, htmlTitle)
	m.Description = firstNonEmpty(ogDesc, twitterDesc, nameDesc)
	m.ImageURL = firstNonEmpty(ogImage, twitterImage)
	return m, nil
}

// iterNodes 深度优先遍历全部节点。
func iterNodes(n *html.Node) func(yield func(*html.Node) bool) {
	return func(yield func(*html.Node) bool) {
		var walk func(*html.Node) bool
		walk = func(node *html.Node) bool {
			if !yield(node) {
				return false
			}
			for child := node.FirstChild; child != nil; child = child.NextSibling {
				if !walk(child) {
					return false
				}
			}
			return true
		}
		walk(n)
	}
}

func metaAttrs(node *html.Node) (name, prop, content string) {
	for _, attr := range node.Attr {
		switch strings.ToLower(attr.Key) {
		case "name":
			name = strings.ToLower(attr.Val)
		case "property":
			prop = strings.ToLower(attr.Val)
		case "content":
			content = strings.TrimSpace(attr.Val)
		}
	}
	return
}

func nodeText(node *html.Node) string {
	var sb strings.Builder
	for child := range iterNodes(node) {
		if child.Type == html.TextNode {
			sb.WriteString(child.Data)
		}
	}
	return strings.TrimSpace(sb.String())
}

func setFirst(dst *string, val string) {
	if *dst == "" && val != "" {
		*dst = val
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
