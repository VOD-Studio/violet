// Package feed 提供 RSS/Atom/JSON Feed 解析的 gofeed 实现。
//
// 实现 application/subscription.FeedParser 端口。生产用，测试用 fake（避免真实网络）。
// gofeed 通吃 RSS 2.0 / Atom / JSON Feed，是 Go 生态 feed 解析业界事实标准。
package feed

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/mmcdole/gofeed"

	appsub "blog-api/internal/application/subscription"
	"blog-api/internal/infrastructure/ssrf"
)

// GoFeedParser 用 mmcdole/gofeed 实现 FeedParser 端口。
// 复用 SSRF 防护（NewSafeTransport）——feed URL 也是外部抓取，同样防 SSRF。
type GoFeedParser struct {
	parser *gofeed.Parser
}

// NewGoFeedParser 构造解析器，内置 SSRF 防护 Transport + 15s 超时。
func NewGoFeedParser() *GoFeedParser {
	fp := gofeed.NewParser()
	fp.Client = &http.Client{
		Timeout:   15 * time.Second,
		Transport: ssrf.NewSafeTransport(),
	}
	return &GoFeedParser{parser: fp}
}

// Parse 抓取并解析 feed URL，返回条目列表（按 feed 原始顺序）。
// publishedAt 优先用 PublishedParsed，回退 UpdatedParsed。
func (g *GoFeedParser) Parse(ctx context.Context, feedURL string) ([]appsub.FeedItem, error) {
	feed, err := g.parser.ParseURLWithContext(feedURL, ctx)
	if err != nil {
		return nil, fmt.Errorf("解析 feed 失败: %w", err)
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
	return items, nil
}
