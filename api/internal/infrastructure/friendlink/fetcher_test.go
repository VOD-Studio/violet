package friendlink

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	appsub "blog-api/internal/application/subscription"
	domain "blog-api/internal/domain/friendlink"
)

type feedFixture struct {
	items  []appsub.FeedItem
	err    error
	called int
}

func (f *feedFixture) Parse(context.Context, string) (string, []appsub.FeedItem, error) {
	f.called++
	return "Feed", f.items, f.err
}

type siteTransport func(*http.Request) (*http.Response, error)

func (f siteTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestFetcherKeepsRSSAndSiteHealthIndependent(t *testing.T) {
	for _, tc := range []struct {
		name, rss, feed, site string
		siteErr, feedErr      error
	}{
		{name: "无RSS", feed: domain.FeedNone, site: domain.SiteUp},
		{name: "正常空源", rss: "https://friend.example/feed", feed: domain.FeedEmpty, site: domain.SiteUp},
		{name: "RSS异常但首页健康", rss: "https://friend.example/feed", feed: domain.FeedError, site: domain.SiteUp, feedErr: errors.New("malformed")},
		{name: "首页不可达但RSS正常为空", rss: "https://friend.example/feed", feed: domain.FeedEmpty, site: domain.SiteDown, siteErr: context.DeadlineExceeded},
	} {
		t.Run(tc.name, func(t *testing.T) {
			parser := &feedFixture{err: tc.feedErr}
			fetcher := &Fetcher{parser: parser, client: &http.Client{Transport: siteTransport(func(r *http.Request) (*http.Response, error) {
				if tc.siteErr != nil {
					return nil, tc.siteErr
				}
				require.Equal(t, "bytes=0-1023", r.Header.Get("Range"))
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("homepage")), Request: r}, nil
			})}}
			result := fetcher.Fetch(t.Context(), "https://friend.example", tc.rss)
			require.Equal(t, tc.feed, result.FeedStatus)
			require.Equal(t, tc.site, result.SiteStatus)
			require.NotNil(t, result.CheckedAt)
			require.Nil(t, result.LatestPublishedAt)
			if tc.rss == "" {
				require.Zero(t, parser.called)
			}
		})
	}
}

func TestFetcherChoosesNewestRealDateAndSafeArticleLink(t *testing.T) {
	old, latest := "2026-11-01T10:00:00Z", "2026-11-18T08:00:00Z"
	parser := &feedFixture{items: []appsub.FeedItem{
		{Title: "无日期", Link: "/undated"},
		{Title: "旧文章", Link: "/old", PublishedAt: &old},
		{Title: "坏链接", Link: "javascript:alert(1)", PublishedAt: &latest},
		{Title: "最新文章", Link: "/new", PublishedAt: &latest},
		{Title: "私网链接", Link: "http://127.0.0.1/admin", PublishedAt: &latest},
	}}
	fetcher := &Fetcher{parser: parser, client: &http.Client{Transport: siteTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
	})}}
	result := fetcher.Fetch(t.Context(), "https://friend.example", "https://friend.example/feed")
	require.Equal(t, domain.FeedOK, result.FeedStatus)
	require.Equal(t, "最新文章", result.LatestTitle)
	require.Equal(t, "https://friend.example/new", result.LatestURL)
	require.Equal(t, latest, result.LatestPublishedAt.Format("2006-01-02T15:04:05Z07:00"))
}
