// Package feed 提供 RSS/Atom/JSON Feed 解析的 gofeed 实现。
//
// 实现 application/subscription.FeedParser 端口。生产用，测试用 fake（避免真实网络）。
// gofeed 通吃 RSS 2.0 / Atom / JSON Feed，是 Go 生态 feed 解析业界事实标准。
//
// 自己 GET feed 而非用 gofeed.ParseURLWithContext：这样能拿到 HTTP 状态码与
// Retry-After 头，便于 T8 失败状态机做错误分类（429/4xx/瞬时）。
package feed

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mmcdole/gofeed"

	appsub "blog-api/internal/application/subscription"
	"blog-api/internal/brand"
	"blog-api/internal/infrastructure/ssrf"
)

// GoFeedParser 用 mmcdole/gofeed 实现 FeedParser 端口。
// 自己 GET + ssrf 防护，再喂 gofeed.Parse(reader)。
type GoFeedParser struct {
	client *http.Client
	parser *gofeed.Parser
}

// NewGoFeedParser 构造解析器。
//
// 代理检测两级策略：
//   - 自动检测：http.ProxyFromEnvironment 读 HTTPS_PROXY/HTTP_PROXY/NO_PROXY（零配置，Go 标准）。
//   - 保底：fallbackProxyURL（来自 config FeedProxyURL），环境变量没设时兜底。
//
// 有代理 → 标准 Transport（SSRF 防护交给代理服务器；代理地址是 loopback 会被 SafeTransport block）。
// 无代理 → SafeTransport（SSRF 防护，生产默认）。
func NewGoFeedParser(fallbackProxyURL string) *GoFeedParser {
	transport := ssrf.NewSafeTransport()

	// 自动检测环境变量代理
	testReq := &http.Request{URL: &url.URL{Scheme: "https", Host: "feed"}}
	if proxy, err := http.ProxyFromEnvironment(testReq); err == nil && proxy != nil {
		transport = &http.Transport{Proxy: http.ProxyFromEnvironment}
	} else if fallbackProxyURL != "" {
		// 保底：config 显式指定的代理
		if u, err := url.Parse(fallbackProxyURL); err == nil {
			transport = &http.Transport{Proxy: http.ProxyURL(u)}
		}
	}

	return &GoFeedParser{
		client: &http.Client{
			Timeout:   30 * time.Second,
			Transport: transport,
		},
		parser: gofeed.NewParser(),
	}
}

// Parse 抓取并解析 feed URL，返回条目列表（按 feed 原始顺序）。
// 失败返回 *appsub.FeedError（结构化，T8 据此分类处理）。
// publishedAt 优先 PublishedParsed，回退 UpdatedParsed。
func (g *GoFeedParser) Parse(ctx context.Context, feedURL string) (string, []appsub.FeedItem, error) {
	if _, err := ssrf.ValidateURL(feedURL); err != nil {
		return "", nil, &appsub.FeedError{Kind: appsub.FeedErrPermanent, Cause: err}
	}
	req, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
	if err != nil {
		return "", nil, &appsub.FeedError{Kind: appsub.FeedErrTransient, Cause: err}
	}
	req.Header.Set("User-Agent", brand.FeedFetcherUA)
	resp, err := g.client.Do(req)
	if err != nil {
		// 网络/超时/DNS 错误 → 瞬时
		return "", nil, &appsub.FeedError{Kind: appsub.FeedErrTransient, Cause: err}
	}
	defer resp.Body.Close()

	// 429 + Retry-After → RateLimited（推迟，不增计数）
	if resp.StatusCode == http.StatusTooManyRequests {
		return "", nil, &appsub.FeedError{
			Kind:       appsub.FeedErrRateLimited,
			StatusCode: resp.StatusCode,
			RetryAfter: parseRetryAfter(resp, time.Now()),
			Cause:      fmt.Errorf("feed 源返回 %d Too Many Requests", resp.StatusCode),
		}
	}
	// 4xx → 永久（404 源没了/403 禁止）
	if resp.StatusCode >= 400 && resp.StatusCode < 500 {
		return "", nil, &appsub.FeedError{
			Kind:       appsub.FeedErrPermanent,
			StatusCode: resp.StatusCode,
			Cause:      fmt.Errorf("feed 源返回 %d", resp.StatusCode),
		}
	}
	// 5xx → 瞬时
	if resp.StatusCode >= 500 {
		return "", nil, &appsub.FeedError{
			Kind:       appsub.FeedErrTransient,
			StatusCode: resp.StatusCode,
			Cause:      fmt.Errorf("feed 源返回 %d", resp.StatusCode),
		}
	}

	// 2xx：限体读取防 OOM，喂 gofeed.Parse
	body := ssrf.LimitBody(resp.Body, ssrf.MaxBodyBytes)
	feed, err := g.parser.Parse(body)
	if err != nil {
		// malformed XML → 永久（feed 格式坏了不会自愈）
		return "", nil, &appsub.FeedError{
			Kind:  appsub.FeedErrPermanent,
			Cause: fmt.Errorf("feed 解析失败: %w", err),
		}
	}

	items := make([]appsub.FeedItem, 0, len(feed.Items))
	for _, item := range feed.Items {
		var publishedStr *string
		if t := item.PublishedParsed; t != nil {
			s := t.Format(time.RFC3339)
			publishedStr = &s
		} else if t := item.UpdatedParsed; t != nil {
			s := t.Format(time.RFC3339)
			publishedStr = &s
		}
		items = append(items, appsub.FeedItem{
			GUID:        item.GUID,
			Link:        item.Link,
			Title:       item.Title,
			PublishedAt: publishedStr,
		})
	}
	return feed.Title, items, nil
}

// parseRetryAfter 解析 Retry-After 头（支持 delta-seconds 与 HTTP-date）。
// 解析失败或无此头时返回 nil（调用方按默认退避）。
func parseRetryAfter(resp *http.Response, now time.Time) *time.Time {
	v := resp.Header.Get("Retry-After")
	if v == "" {
		return nil
	}
	// 先尝试 delta-seconds
	if secs, err := strconv.Atoi(v); err == nil && secs >= 0 {
		t := now.Add(time.Duration(secs) * time.Second)
		return &t
	}
	// 再尝试 HTTP-date (RFC1123)
	if t, err := time.Parse(time.RFC1123, v); err == nil {
		return &t
	}
	return nil
}


// 编译期断言：实现 FeedParser 端口。
var _ appsub.FeedParser = (*GoFeedParser)(nil)
