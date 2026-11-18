package friendlink

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	app "blog-api/internal/application/friendlink"
	appsub "blog-api/internal/application/subscription"
	"blog-api/internal/brand"
	domain "blog-api/internal/domain/friendlink"
	"blog-api/internal/infrastructure/feed"
	"blog-api/internal/infrastructure/ssrf"
)

// Fetcher 用独立的安全直连客户端抓 RSS 和探测首页。
type Fetcher struct {
	parser appsub.FeedParser
	client *http.Client
}

func NewFetcher() *Fetcher {
	return &Fetcher{parser: feed.NewSafeGoFeedParser(), client: feed.NewSafeClient()}
}

func (f *Fetcher) Fetch(ctx context.Context, siteURL, rssURL string) domain.Activity {
	now := time.Now().UTC()
	activity := domain.Activity{FeedStatus: domain.FeedNone, SiteStatus: domain.SiteDown, CheckedAt: &now}
	// 两次请求各自有超时；RSS 失败不借用首页结果，也不阻断下一站。
	if f.siteReachable(ctx, siteURL) {
		activity.SiteStatus = domain.SiteUp
	}
	if rssURL == "" {
		return activity
	}
	if ctx.Err() != nil {
		activity.FeedStatus = domain.FeedError
		return activity
	}
	_, items, err := f.parser.Parse(ctx, rssURL)
	if err != nil {
		activity.FeedStatus = domain.FeedError
		return activity
	}
	activity.FeedStatus = domain.FeedEmpty
	base, err := url.Parse(rssURL)
	if err != nil || base.Hostname() == "" {
		activity.FeedStatus = domain.FeedError
		return activity
	}
	for _, item := range items {
		if strings.TrimSpace(item.Link) == "" {
			continue
		}
		link, err := url.Parse(strings.TrimSpace(item.Link))
		if err != nil {
			continue
		}
		link = base.ResolveReference(link)
		if !safeArticleURL(link) || strings.TrimSpace(item.Title) == "" {
			continue
		}
		var published *time.Time
		if item.PublishedAt != nil {
			if parsed, err := time.Parse(time.RFC3339, *item.PublishedAt); err == nil {
				parsed = parsed.UTC()
				published = &parsed
			}
		}
		if activity.LatestURL != "" && (published == nil || (activity.LatestPublishedAt != nil && !published.After(*activity.LatestPublishedAt))) {
			continue
		}
		title := []rune(strings.TrimSpace(item.Title))
		activity.LatestTitle = string(title[:min(300, len(title))])
		activity.LatestURL = link.String()
		activity.LatestPublishedAt = published
		activity.FeedStatus = domain.FeedOK
	}
	return activity
}

func safeArticleURL(u *url.URL) bool {
	if (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil || len(u.String()) > 2048 {
		return false
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && ssrf.IsPrivateIP(ip) {
		return false
	}
	return true
}

func (f *Fetcher) siteReachable(ctx context.Context, rawURL string) bool {
	u, err := ssrf.ValidateURL(rawURL)
	if err != nil || u.User != nil {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return false
	}
	req.Header.Set("User-Agent", brand.FeedFetcherUA)
	req.Header.Set("Range", "bytes=0-1023")
	resp, err := f.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	// 健康仅需要 HTTP 响应，最多读取 1 KiB，避免首页下载拖住刷新。
	_, err = io.Copy(io.Discard, io.LimitReader(resp.Body, 1024))
	return err == nil && resp.StatusCode >= 200 && resp.StatusCode < 400
}

var _ app.ActivityFetcher = (*Fetcher)(nil)
