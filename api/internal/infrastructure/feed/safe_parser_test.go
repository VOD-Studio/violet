package feed

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"blog-api/internal/infrastructure/ssrf"
)

type safeRoundTrip func(*http.Request) (*http.Response, error)

func (fn safeRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return fn(r) }

func TestSafeParserRejectsUnsafeTargetsAndEnvironmentProxy(t *testing.T) {
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:9")
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:9")
	parser := NewSafeGoFeedParser()
	require.Nil(t, parser.client.Transport.(*http.Transport).Proxy)
	for _, target := range []string{"file:///etc/passwd", "http://127.0.0.1", "http://[::1]", "http://169.254.169.254/latest/meta-data"} {
		_, _, err := parser.Parse(t.Context(), target)
		require.Error(t, err, target)
	}
}

func TestSafeParserRejectsPrivateAndExcessiveRedirects(t *testing.T) {
	for _, destination := range []string{"http://127.0.0.1/private", "http://169.254.169.254/", "file:///etc/passwd", "http://reader@8.8.8.8/", "http://8.8.8.8/again"} {
		t.Run(destination, func(t *testing.T) {
			parser := NewSafeGoFeedParser()
			requests := 0
			parser.client.Transport = safeRoundTrip(func(r *http.Request) (*http.Response, error) {
				requests++
				return &http.Response{StatusCode: 302, Header: http.Header{"Location": {destination}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
			})
			_, _, err := parser.Parse(t.Context(), "https://8.8.8.8/feed")
			require.Error(t, err)
			if strings.HasSuffix(destination, "/again") {
				require.Equal(t, 4, requests)
			} else {
				require.Equal(t, 1, requests)
			}
		})
	}
}

type repeatedText struct{ read int64 }

func (r *repeatedText) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = 'a'
	}
	r.read += int64(len(p))
	return len(p), nil
}

func TestSafeParserLimitsBodyAndHandlesMalformedTimeoutAndEmpty(t *testing.T) {
	parser := NewSafeGoFeedParser()
	body := &repeatedText{}
	parser.client.Transport = safeRoundTrip(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(io.MultiReader(strings.NewReader(`<rss version="2.0"><channel><title>Feed</title><description>`), body)), Header: http.Header{}, Request: r}, nil
	})
	_, _, err := parser.Parse(t.Context(), "https://8.8.8.8/feed")
	require.Error(t, err)
	require.LessOrEqual(t, body.read, ssrf.MaxBodyBytes+1)
	for _, content := range []string{"<rss><broken", `<rss version="2.0"><channel><title>Empty</title></channel></rss>`} {
		parser.client.Transport = safeRoundTrip(func(r *http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(content)), Header: http.Header{}, Request: r}, nil
		})
		_, items, err := parser.Parse(t.Context(), "https://8.8.8.8/feed")
		if strings.Contains(content, "broken") {
			require.Error(t, err)
		} else {
			require.NoError(t, err)
			require.Empty(t, items)
		}
	}
	parser.client.Transport = safeRoundTrip(func(r *http.Request) (*http.Response, error) {
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	ctx, cancel := context.WithTimeout(t.Context(), time.Millisecond)
	defer cancel()
	_, _, err = parser.Parse(ctx, "https://8.8.8.8/feed")
	require.Error(t, err)
}
