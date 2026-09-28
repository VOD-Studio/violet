package xtweet

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/tweet"
	"github.com/stretchr/testify/require"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return fn(req) }

func fxFixture(text string) string {
	return fmt.Sprintf(`{"code":200,"status":{"type":"status","id":"20","text":%q,"raw_text":{"text":%q,"display_text_range":[0,%d],"facets":[]},"is_note_tweet":false,"created_timestamp":1142974214,"author":{"id":"12","name":"Original","screen_name":"jack"},"media":{}}}`, text, text, len(utf16.Encode([]rune(text))))
}

func syFixture(text string) string {
	return fmt.Sprintf(`{"__typename":"Tweet","id_str":"20","text":%q,"display_text_range":[0,%d],"created_at":"2006-03-21T20:50:14.000Z","user":{"id_str":"12","name":"Original","screen_name":"jack"}}`, text, len(utf16.Encode([]rune(text))))
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}
}

func TestSyndicationTokenJavaScriptFixtures(t *testing.T) {
	for id, expected := range map[string]string{
		"20": "6dq1a2xwd93", "1228393702244134912": "2z741ywaw31", "2040511285998313827": "4y2gevhhhm", "99999999999999999999": "6qen9jwl6qt", "1000000000000000000": "2f9lc2ug9mm",
	} {
		require.Equal(t, expected, syndicationToken(id), id)
	}
}

func TestNormalizeUTF16FacetsAndMedia(t *testing.T) {
	raw := "中文😀e\u0301 @jack #话题 https://t.co/link https://t.co/media [doge]"
	index := func(part string) []int {
		start := strings.Index(raw, part)
		return []int{len(utf16.Encode([]rune(raw[:start]))), len(utf16.Encode([]rune(raw[:start+len(part)])))}
	}
	facets := []facet{
		{Type: "mention", Indices: index("@jack")}, {Type: "hashtag", Indices: index("#话题")},
		{Type: "url", Indices: index("https://t.co/link"), Replacement: "https://example.com/story", Display: "example.com/story"},
		{Type: "media", Indices: index("https://t.co/media")},
	}
	text, segments, err := normalizeText(raw, nil, facets)
	require.NoError(t, err)
	require.Contains(t, text, "中文😀e\u0301")
	require.Contains(t, text, "[doge]")
	require.Contains(t, text, "example.com/story")
	require.NotContains(t, text, "t.co/media")
	require.Equal(t, "https://x.com/jack", segments[1].URL)
	plain, _, err := normalizeText("keep https://t.co/unknown", nil, nil)
	require.NoError(t, err)
	require.Contains(t, plain, "https://t.co/unknown")
	_, _, err = normalizeText("😀x", nil, []facet{{Type: "url", Indices: []int{1, 2}}})
	require.Error(t, err)
	unsafe, segments, err := normalizeText("link", nil, []facet{{Type: "url", Indices: []int{0, 4}, Replacement: "javascript:alert(1)"}})
	require.NoError(t, err)
	require.Equal(t, "link", unsafe)
	require.Empty(t, segments[0].URL)
}

func TestFetcherFallbackAndTerminalStates(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
		calls  int
		kind   string
	}{
		{"success", 200, fxFixture("ordinary"), 1, ""},
		{"business_failure", 200, `{"code":500,"status":null}`, 2, ""},
		{"http_failure", 503, `{}`, 2, ""},
		{"ambiguous_404", 404, `{}`, 2, ""},
		{"deleted", 200, `{"code":200,"status":{"type":"tombstone","id":"20","reason":"deleted"}}`, 1, "deleted"},
		{"private", 200, `{"code":200,"status":{"type":"tombstone","id":"20","reason":"private"}}`, 1, "private"},
		{"restricted", 403, `{}`, 1, "restricted"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				calls++
				require.Empty(t, req.Header.Get("Authorization"))
				require.Empty(t, req.Header.Get("Cookie"))
				if calls == 1 {
					require.Equal(t, "https://api.fxtwitter.com/2/status/20", req.URL.String())
					return jsonResponse(tc.status, tc.body), nil
				}
				require.Equal(t, "cdn.syndication.twimg.com", req.URL.Hostname())
				require.Equal(t, "6dq1a2xwd93", req.URL.Query().Get("token"))
				return jsonResponse(200, syFixture("fallback")), nil
			})}
			result, err := NewFetcher(client).Fetch(context.Background(), "20")
			if tc.kind == "" {
				require.NoError(t, err)
				require.Equal(t, "20", result.SourceID)
			} else {
				var failure *apptweet.ExternalFetchError
				require.ErrorAs(t, err, &failure)
				require.Equal(t, tc.kind, failure.Kind)
			}
			require.Equal(t, tc.calls, calls)
		})
	}
}

func TestLongTweetCompleteness(t *testing.T) {
	var raw fxTweet
	var envelope struct {
		Status *fxTweet `json:"status"`
	}
	require.NoError(t, json.Unmarshal([]byte(fxFixture(strings.Repeat("完整正文", 200))), &envelope))
	raw = *envelope.Status
	long := true
	raw.IsNoteTweet = &long
	result, err := normalizeFX(&raw, 0)
	require.NoError(t, err)
	require.Equal(t, tweet.TextComplete, result.Snapshot.Completeness)
	raw.RawText.DisplayTextRange[1] = 280
	result, err = normalizeFX(&raw, 0)
	require.NoError(t, err)
	require.Equal(t, tweet.TextUnknown, result.Snapshot.Completeness)
	var sy syTweet
	require.NoError(t, json.Unmarshal([]byte(syFixture("truncated…")), &sy))
	sy.NoteTweet = json.RawMessage(`{"id":"1234567890123456789"}`)
	result, err = normalizeSyndication(&sy, 0)
	require.NoError(t, err)
	require.Equal(t, tweet.TextUnknown, result.Snapshot.Completeness)
}

func TestRateLimitCooldownCoversHTTPAndBusinessCodes(t *testing.T) {
	for _, status := range []int{200, 429} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			calls := make(map[string]int)
			client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				calls[req.URL.Hostname()]++
				if req.URL.Hostname() == "api.fxtwitter.com" {
					res := jsonResponse(status, `{"code":429,"status":null}`)
					res.Header.Set("Retry-After", "120")
					return res, nil
				}
				return jsonResponse(503, `{}`), nil
			})}
			fetcher := NewFetcher(client)
			for range 2 {
				_, err := fetcher.Fetch(context.Background(), "20")
				var failure *apptweet.ExternalFetchError
				require.ErrorAs(t, err, &failure)
				require.Equal(t, "rate_limited", failure.Kind)
				require.Greater(t, failure.RetryAfter, time.Minute)
			}
			require.Equal(t, 1, calls["api.fxtwitter.com"])
			require.Equal(t, 2, calls["cdn.syndication.twimg.com"])
		})
	}
}

func TestUninterpretableResponsesAndRedirects(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return jsonResponse(200, `{"code":200,"tweet":{}}`), nil
		}
		return jsonResponse(200, `{}`), nil
	})}
	_, err := NewFetcher(client).Fetch(context.Background(), "20")
	var failure *apptweet.ExternalFetchError
	require.ErrorAs(t, err, &failure)
	require.Equal(t, "unavailable", failure.Kind)
	redirect := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Hostname() == "127.0.0.1" {
			t.Fatal("redirect reached private host")
		}
		res := jsonResponse(302, `{}`)
		res.Header.Set("Location", "https://127.0.0.1/private")
		return res, nil
	})}
	_, err = NewFetcher(redirect).Fetch(context.Background(), "20")
	require.Error(t, err)
}

func TestQuoteDepthAndPrivateQuote(t *testing.T) {
	var envelope struct {
		Status *fxTweet `json:"status"`
	}
	require.NoError(t, json.Unmarshal([]byte(fxFixture("public")), &envelope))
	quote := *envelope.Status
	quote.ID = "21"
	quote.Quote = envelope.Status
	envelope.Status.Quote = &quote
	result, err := normalizeFX(envelope.Status, 0)
	require.NoError(t, err)
	require.NotNil(t, result.Quote)
	require.Nil(t, result.Quote.Quote)
	require.Contains(t, result.Quote.Snapshot.QuoteURL, "/20")
	quote.Author.Protected = true
	result, err = normalizeFX(envelope.Status, 0)
	require.NoError(t, err)
	require.Equal(t, tweet.ExternalPrivate, result.Quote.Availability)
	require.Equal(t, tweet.ExternalAvailable, result.Availability)
}
