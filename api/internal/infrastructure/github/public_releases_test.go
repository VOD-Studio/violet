package github

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	domainreleases "blog-api/internal/domain/releases"
)

type releasesRoundTripper func(*http.Request) (*http.Response, error)

func (f releasesRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestSummarizePublicReleases(t *testing.T) {
	const firstPage = `[
		{"tag_name":"v1","published_at":"2026-01-01T00:00:00Z","html_url":"https://github.com/vod/first/releases/tag/v1"},
		{"tag_name":"draft","draft":true},
		{"tag_name":"rc","prerelease":true,"published_at":"2026-10-01T00:00:00Z"}
	]`
	const secondPage = `[
		{"tag_name":"v2","published_at":"2026-05-01T00:00:00Z","html_url":"https://github.com/vod/first/releases/tag/v2"},
		{"tag_name":"v0","published_at":"2025-01-01T00:00:00Z","html_url":"https://github.com/vod/first/releases/tag/v0"}
	]`
	var requests []string
	adapter := NewAdapter()
	adapter.client.Transport = releasesRoundTripper(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, "https", req.URL.Scheme)
		require.Equal(t, "api.github.com", req.URL.Host)
		require.Empty(t, req.Header.Get("Authorization"))
		require.Equal(t, "100", req.URL.Query().Get("per_page"))
		key := req.URL.Path + ":" + req.URL.Query().Get("page")
		requests = append(requests, key)
		status, payload := http.StatusOK, `[]`
		header := make(http.Header)
		switch key {
		case "/repos/vod/first/releases:1", "/repos/vod/broken/releases:1":
			payload = firstPage
			header.Set("Link", `<https://api.github.com/repositories/123/releases?per_page=100&page=2>; rel="next", <https://api.github.com/repositories/123/releases?page=2>; rel="last"`)
		case "/repos/vod/first/releases:2":
			payload = secondPage
			header.Set("Link", `<https://api.github.com/repositories/123/releases?page=1>; rel="prev"`)
		case "/repos/vod/broken/releases:2":
			status = http.StatusServiceUnavailable
		case "/repos/vod/untrusted/releases:1":
			payload = firstPage
			header.Set("Link", `<https://example.com/releases?page=2>; rel="next"`)
		case "/repos/vod/redirect/releases:1":
			status = http.StatusMovedPermanently
			header.Set("Location", "https://api.github.com/repos/vod/first/releases")
		case "/repos/vod/empty/releases:1":
		default:
			t.Fatalf("unexpected request: %s", req.URL)
		}
		return &http.Response{StatusCode: status, Header: header, Body: io.NopCloser(strings.NewReader(payload))}, nil
	})

	ctx := context.Background()
	for _, repo := range []string{"broken", "untrusted", "redirect"} {
		summary, err := adapter.SummarizePublicReleases(ctx, "vod", repo)
		require.Error(t, err, repo)
		require.Empty(t, summary, repo)
	}
	summary, err := adapter.SummarizePublicReleases(ctx, "vod", "empty")
	require.NoError(t, err)
	require.Empty(t, summary)
	summary, err = adapter.SummarizePublicReleases(ctx, "vod", "first")
	require.NoError(t, err)
	require.Equal(t, domainreleases.PublicSummary{
		TagName: "v2", PublishedAt: "2026-05-01T00:00:00Z", Count: 3,
		HTMLURL: "https://github.com/vod/first/releases/tag/v2",
	}, summary)
	require.Equal(t, []string{
		"/repos/vod/broken/releases:1", "/repos/vod/broken/releases:2", "/repos/vod/untrusted/releases:1",
		"/repos/vod/redirect/releases:1", "/repos/vod/empty/releases:1", "/repos/vod/first/releases:1", "/repos/vod/first/releases:2",
	}, requests)
}
