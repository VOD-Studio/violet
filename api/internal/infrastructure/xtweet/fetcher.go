package xtweet

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	apptweet "blog-api/internal/application/tweet"
	"blog-api/internal/domain/tweet"
	"blog-api/internal/infrastructure/ssrf"
)

const maxJSONBytes = 2 << 20

type Fetcher struct {
	client   *http.Client
	mu       sync.Mutex
	cooldown map[string]time.Time
}

func NewFetcher(client *http.Client) *Fetcher {
	return &Fetcher{client: safeClient(client, "api.fxtwitter.com", "cdn.syndication.twimg.com"), cooldown: make(map[string]time.Time)}
}

type allowedTransport struct {
	hosts   []string
	direct  http.RoundTripper
	proxied http.RoundTripper
	proxy   func(*http.Request) (*url.URL, error)
}

func (t *allowedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := checkURL(req.URL, t.hosts...); err != nil {
		return nil, err
	}
	if t.proxy != nil {
		proxy, err := t.proxy(req)
		if err != nil {
			return nil, err
		}
		if proxy != nil {
			return t.proxied.RoundTrip(req)
		}
	}
	return t.direct.RoundTrip(req)
}

func safeClient(client *http.Client, hosts ...string) *http.Client {
	transport := &allowedTransport{
		hosts: hosts, direct: ssrf.NewSafeTransport(),
		proxied: &http.Transport{Proxy: http.ProxyFromEnvironment},
		proxy:   http.ProxyFromEnvironment,
	}
	if client != nil && client.Transport != nil {
		transport.direct, transport.proxy = client.Transport, nil
	}
	// 部署配置的代理承担代理链路的网络隔离；NO_PROXY 仍逐请求走 SSRF 安全直连。
	copy := http.Client{Transport: transport}
	copy.Timeout = 6 * time.Second
	copy.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return errors.New("redirect limit")
		}
		return checkURL(req.URL, hosts...)
	}
	return &copy
}

func checkURL(u *url.URL, hosts ...string) error {
	if u.Scheme != "https" || u.User != nil || (u.Port() != "" && u.Port() != "443") {
		return errors.New("unsafe URL")
	}
	for _, host := range hosts {
		if u.Hostname() == host {
			return nil
		}
	}
	return errors.New("host is not allowed")
}

func (f *Fetcher) Fetch(ctx context.Context, id string) (*apptweet.ExternalFetchResult, error) {
	if !tweet.ValidXID(id) {
		return nil, &apptweet.ExternalFetchError{Kind: "invalid", StopFallback: true}
	}
	result, err := f.fetchFX(ctx, id)
	if err == nil {
		return result, nil
	}
	var failure *apptweet.ExternalFetchError
	if errors.As(err, &failure) && failure.StopFallback {
		return nil, failure
	}
	if ctx.Err() != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	result, fallbackErr := f.fetchSyndication(ctx, id)
	if fallbackErr == nil {
		return result, nil
	}
	var fallback *apptweet.ExternalFetchError
	if errors.As(fallbackErr, &fallback) && fallback.StopFallback {
		return nil, fallback
	}
	if failure != nil && failure.RetryAfter > 0 {
		return nil, failure
	}
	return nil, fallbackErr
}

func (f *Fetcher) get(ctx context.Context, endpoint string) ([]byte, int, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, 0, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	req.Header.Set("Accept", "application/json")
	f.mu.Lock()
	remaining := time.Until(f.cooldown[req.URL.Hostname()])
	f.mu.Unlock()
	if remaining > 0 {
		return nil, 429, remaining, &apptweet.ExternalFetchError{Kind: "rate_limited", RetryAfter: remaining}
	}
	req.Header.Set("User-Agent", "Violet/1.0 (+public-tweet-preview)")
	res, err := f.client.Do(req)
	if err != nil {
		return nil, 0, 0, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	defer res.Body.Close()
	retry := retryAfter(res.Header.Get("Retry-After"))
	if res.StatusCode == 429 {
		retry = f.setCooldown(req.URL.Hostname(), retry)
	}
	if !strings.Contains(res.Header.Get("Content-Type"), "application/json") {
		return nil, res.StatusCode, retry, upstreamFailure(res.StatusCode, retry)
	}
	data, err := io.ReadAll(ssrf.LimitBody(res.Body, maxJSONBytes))
	if err != nil {
		return nil, res.StatusCode, retry, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	return data, res.StatusCode, retry, nil
}

func (f *Fetcher) setCooldown(host string, retry time.Duration) time.Duration {
	retry = max(retry, 30*time.Second)
	f.mu.Lock()
	f.cooldown[host] = time.Now().Add(retry)
	f.mu.Unlock()
	return retry
}

func upstreamFailure(status int, retry time.Duration) *apptweet.ExternalFetchError {
	switch status {
	case 401, 403:
		return &apptweet.ExternalFetchError{Kind: "restricted", StopFallback: true}
	case 404:
		return &apptweet.ExternalFetchError{Kind: "unavailable"}
	case 429:
		return &apptweet.ExternalFetchError{Kind: "rate_limited", RetryAfter: retry}
	default:
		return &apptweet.ExternalFetchError{Kind: "temporary"}
	}
}

func retryAfter(raw string) time.Duration {
	if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
		return time.Duration(min(seconds, 86400)) * time.Second
	}
	if date, err := http.ParseTime(raw); err == nil {
		return min(max(time.Until(date), 0), 24*time.Hour)
	}
	return 0
}

type fxMedia struct {
	Type         string `json:"type"`
	URL          string `json:"url"`
	ThumbnailURL string `json:"thumbnail_url"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
	Alt          string `json:"altText"`
}

type fxTweet struct {
	Type             string `json:"type"`
	Reason           string `json:"reason"`
	ID               string `json:"id"`
	Text             string `json:"text"`
	CreatedAt        string `json:"created_at"`
	CreatedTimestamp int64  `json:"created_timestamp"`
	IsNoteTweet      *bool  `json:"is_note_tweet"`
	Truncated        bool   `json:"truncated"`
	RawText          *struct {
		Text             string  `json:"text"`
		DisplayTextRange []int   `json:"display_text_range"`
		Facets           []facet `json:"facets"`
	} `json:"raw_text"`
	Author struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		Handle       string `json:"screen_name"`
		AvatarURL    string `json:"avatar_url"`
		Protected    bool   `json:"protected"`
		Verification *struct {
			Verified bool `json:"verified"`
		} `json:"verification"`
	} `json:"author"`
	Media struct {
		All    []fxMedia `json:"all"`
		Photos []fxMedia `json:"photos"`
		Videos []fxMedia `json:"videos"`
	} `json:"media"`
	Quote   *fxTweet        `json:"quote"`
	Poll    json.RawMessage `json:"poll"`
	Article json.RawMessage `json:"article"`
	Card    *struct {
		Name string `json:"card_name"`
	} `json:"card"`
}

func (f *Fetcher) fetchFX(ctx context.Context, id string) (*apptweet.ExternalFetchResult, error) {
	data, status, retry, err := f.get(ctx, "https://api.fxtwitter.com/2/status/"+id)
	if err != nil {
		return nil, err
	}
	var envelope struct {
		Code   int      `json:"code"`
		Status *fxTweet `json:"status"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	if envelope.Status != nil && envelope.Status.Type == "tombstone" {
		return nil, tombstoneFailure(envelope.Status.Reason)
	}
	if status != 200 {
		return nil, upstreamFailure(status, retry)
	}
	if envelope.Code != 200 {
		if envelope.Code == 429 {
			retry = f.setCooldown("api.fxtwitter.com", retry)
		}
		return nil, upstreamFailure(envelope.Code, retry)
	}
	if envelope.Status == nil || envelope.Status.ID != id {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	return normalizeFX(envelope.Status, 0)
}

func tombstoneFailure(reason string) *apptweet.ExternalFetchError {
	if reason == tweet.ExternalDeleted || reason == tweet.ExternalPrivate {
		return &apptweet.ExternalFetchError{Kind: reason, StopFallback: true}
	}
	return &apptweet.ExternalFetchError{Kind: "restricted", StopFallback: true}
}

func normalizeFX(raw *fxTweet, depth int) (*apptweet.ExternalFetchResult, error) {
	if raw.Type == "tombstone" {
		if !tweet.ValidXID(raw.ID) {
			return nil, &apptweet.ExternalFetchError{Kind: "unavailable", StopFallback: true}
		}
		state := raw.Reason
		if state != tweet.ExternalDeleted && state != tweet.ExternalPrivate {
			state = tweet.ExternalUnavailable
		}
		return &apptweet.ExternalFetchResult{SourceID: raw.ID, CanonicalURL: tweet.XCanonicalURL(raw.ID, ""), Availability: state, FetchSource: "fxtwitter"}, nil
	}
	if raw.Author.Protected {
		if depth > 0 && tweet.ValidXID(raw.ID) {
			return &apptweet.ExternalFetchResult{SourceID: raw.ID, CanonicalURL: tweet.XCanonicalURL(raw.ID, ""), Availability: tweet.ExternalPrivate, FetchSource: "fxtwitter"}, nil
		}
		return nil, tombstoneFailure(tweet.ExternalPrivate)
	}
	if raw.Type != "status" || !tweet.ValidXID(raw.ID) || !tweet.ValidXID(raw.Author.ID) || !tweet.ValidXHandle(raw.Author.Handle) || raw.RawText == nil || len(raw.RawText.Text) > 100000 {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	text, segments, err := normalizeText(raw.RawText.Text, raw.RawText.DisplayTextRange, raw.RawText.Facets)
	if err != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "incomplete", StopFallback: true}
	}
	created := time.Unix(raw.CreatedTimestamp, 0).UTC()
	if raw.CreatedTimestamp == 0 {
		created, err = time.Parse(time.RubyDate, raw.CreatedAt)
		if err != nil {
			return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
		}
	}
	snapshot := &tweet.ExternalSnapshot{
		Author: tweet.ExternalAuthor{ID: raw.Author.ID, Name: raw.Author.Name, Handle: raw.Author.Handle, URL: "https://x.com/" + raw.Author.Handle, AvatarSourceURL: raw.Author.AvatarURL},
		Text:   text, Segments: segments, PublishedAt: created, Completeness: tweet.TextComplete,
		Media: []tweet.ExternalMedia{}, Warnings: []string{},
	}
	if raw.Author.Verification != nil {
		snapshot.Author.Verified = &raw.Author.Verification.Verified
	}
	if raw.Truncated {
		snapshot.Completeness = tweet.TextPartial
	} else if raw.IsNoteTweet == nil {
		snapshot.Completeness = tweet.TextUnknown
	} else if *raw.IsNoteTweet {
		// FxTwitter 仅在完整 note_tweet 文本替换 legacy 正文后设置此标记，并给出完整 UTF-16 范围。
		fullLength := len(utf16.Encode([]rune(raw.RawText.Text)))
		if len(raw.RawText.DisplayTextRange) != 2 || raw.RawText.DisplayTextRange[0] != 0 || raw.RawText.DisplayTextRange[1] != fullLength {
			snapshot.Completeness = tweet.TextUnknown
		}
	}
	media := raw.Media.All
	if len(media) == 0 {
		media = append(append([]fxMedia{}, raw.Media.Photos...), raw.Media.Videos...)
	}
	if len(media) > 8 {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	for _, m := range media {
		source := m.URL
		switch m.Type {
		case "photo":
		case "video", "gif", "animated_gif":
			source = m.ThumbnailURL
		default:
			snapshot.Warnings = append(snapshot.Warnings, "部分媒体需在 X 查看")
			continue
		}
		kind := m.Type
		if kind == "gif" {
			kind = "animated_gif"
		}
		snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: kind, SourceURL: source, Width: m.Width, Height: m.Height, Alt: m.Alt})
	}
	if nonNull(raw.Poll) {
		snapshot.Warnings = append(snapshot.Warnings, "投票请在 X 查看")
	}
	if nonNull(raw.Article) {
		snapshot.Warnings = append(snapshot.Warnings, "X Article 请在 X 查看")
	}
	if raw.Card != nil && strings.Contains(raw.Card.Name, "broadcast") {
		snapshot.Warnings = append(snapshot.Warnings, "直播请在 X 查看")
	}
	result := &apptweet.ExternalFetchResult{SourceID: raw.ID, CanonicalURL: tweet.XCanonicalURL(raw.ID, raw.Author.Handle), Snapshot: snapshot, Availability: tweet.ExternalAvailable, FetchSource: "fxtwitter"}
	if raw.Quote != nil && tweet.ValidXID(raw.Quote.ID) {
		snapshot.QuoteURL = tweet.XCanonicalURL(raw.Quote.ID, raw.Quote.Author.Handle)
		if depth == 0 && raw.Quote.ID != raw.ID {
			result.Quote, err = normalizeFX(raw.Quote, 1)
			if err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}

func nonNull(value json.RawMessage) bool {
	return len(value) > 0 && string(value) != "null" && string(value) != "{}"
}

type syEntity struct {
	Indices     []int  `json:"indices"`
	URL         string `json:"url"`
	ExpandedURL string `json:"expanded_url"`
	DisplayURL  string `json:"display_url"`
}

type syMedia struct {
	Type     string `json:"type"`
	URL      string `json:"media_url_https"`
	Alt      string `json:"ext_alt_text"`
	Indices  []int  `json:"indices"`
	Original struct {
		Width  int `json:"width"`
		Height int `json:"height"`
	} `json:"original_info"`
}

type syTweet struct {
	Typename         string          `json:"__typename"`
	ID               string          `json:"id_str"`
	Text             string          `json:"text"`
	CreatedAt        string          `json:"created_at"`
	DisplayTextRange []int           `json:"display_text_range"`
	NoteTweet        json.RawMessage `json:"note_tweet"`
	Truncated        bool            `json:"truncated"`
	IsStaleEdit      bool            `json:"isStaleEdit"`
	User             struct {
		ID           string `json:"id_str"`
		Name         string `json:"name"`
		Handle       string `json:"screen_name"`
		AvatarURL    string `json:"profile_image_url_https"`
		Verified     *bool  `json:"verified"`
		BlueVerified *bool  `json:"is_blue_verified"`
		Protected    bool   `json:"protected"`
	} `json:"user"`
	Entities struct {
		URLs     []syEntity `json:"urls"`
		Mentions []syEntity `json:"user_mentions"`
		Hashtags []syEntity `json:"hashtags"`
		Media    []syMedia  `json:"media"`
	} `json:"entities"`
	MediaDetails []syMedia `json:"mediaDetails"`
	Photos       []struct {
		URL    string `json:"url"`
		Width  int    `json:"width"`
		Height int    `json:"height"`
	} `json:"photos"`
	Video *struct {
		Poster string `json:"poster"`
	} `json:"video"`
	QuotedTweet *syTweet `json:"quoted_tweet"`
}

const syndicationFeatures = "tfw_timeline_list:;tfw_follower_count_sunset:true;tfw_tweet_edit_backend:on;tfw_refsrc_session:on;tfw_fosnr_soft_interventions_enabled:on;tfw_show_birdwatch_pivots_enabled:on;tfw_show_business_verified_badge:on;tfw_duplicate_scribes_to_settings:on;tfw_use_profile_image_shape_enabled:on;tfw_show_blue_verified_badge:on;tfw_legacy_timeline_sunset:true;tfw_show_gov_verified_badge:on;tfw_show_business_affiliate_badge:on;tfw_tweet_edit_frontend:on"

func (f *Fetcher) fetchSyndication(ctx context.Context, id string) (*apptweet.ExternalFetchResult, error) {
	query := url.Values{"id": {id}, "lang": {"en"}, "token": {syndicationToken(id)}, "features": {syndicationFeatures}}
	data, status, retry, err := f.get(ctx, "https://cdn.syndication.twimg.com/tweet-result?"+query.Encode())
	if err != nil {
		return nil, err
	}
	if status != 200 {
		return nil, upstreamFailure(status, retry)
	}
	var raw syTweet
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "temporary"}
	}
	if raw.Typename == "TweetTombstone" {
		return nil, &apptweet.ExternalFetchError{Kind: "restricted", StopFallback: true}
	}
	if raw.ID != id {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	return normalizeSyndication(&raw, 0)
}

func normalizeSyndication(raw *syTweet, depth int) (*apptweet.ExternalFetchResult, error) {
	if raw.User.Protected {
		if depth > 0 && tweet.ValidXID(raw.ID) {
			return &apptweet.ExternalFetchResult{SourceID: raw.ID, CanonicalURL: tweet.XCanonicalURL(raw.ID, ""), Availability: tweet.ExternalPrivate, FetchSource: "syndication"}, nil
		}
		return nil, tombstoneFailure(tweet.ExternalPrivate)
	}
	if !tweet.ValidXID(raw.ID) || !tweet.ValidXID(raw.User.ID) || !tweet.ValidXHandle(raw.User.Handle) || len(raw.Text) > 100000 {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	facets := make([]facet, 0, len(raw.Entities.URLs)+len(raw.Entities.Mentions)+len(raw.Entities.Hashtags)+len(raw.Entities.Media))
	for _, e := range raw.Entities.URLs {
		facets = append(facets, facet{Type: "url", Indices: e.Indices, Original: e.URL, Replacement: e.ExpandedURL, Display: e.DisplayURL})
	}
	for _, e := range raw.Entities.Mentions {
		facets = append(facets, facet{Type: "mention", Indices: e.Indices})
	}
	for _, e := range raw.Entities.Hashtags {
		facets = append(facets, facet{Type: "hashtag", Indices: e.Indices})
	}
	for _, e := range raw.Entities.Media {
		if len(e.Indices) == 2 {
			facets = append(facets, facet{Type: "media", Indices: e.Indices})
		}
	}
	text, segments, err := normalizeText(raw.Text, raw.DisplayTextRange, facets)
	if err != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "incomplete", StopFallback: true}
	}
	created, err := time.Parse(time.RFC3339Nano, raw.CreatedAt)
	if err != nil {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	snapshot := &tweet.ExternalSnapshot{
		Author: tweet.ExternalAuthor{ID: raw.User.ID, Name: raw.User.Name, Handle: raw.User.Handle, URL: "https://x.com/" + raw.User.Handle, AvatarSourceURL: raw.User.AvatarURL, Verified: raw.User.Verified},
		Text:   text, Segments: segments, PublishedAt: created, Completeness: tweet.TextComplete, Media: []tweet.ExternalMedia{}, Warnings: []string{},
	}
	if raw.User.BlueVerified != nil && *raw.User.BlueVerified {
		snapshot.Author.Verified = raw.User.BlueVerified
	}
	if raw.Truncated {
		snapshot.Completeness = tweet.TextPartial
	} else if nonNull(raw.NoteTweet) || raw.IsStaleEdit {
		snapshot.Completeness = tweet.TextUnknown
	}
	if len(raw.MediaDetails) > 8 || len(raw.Photos) > 8 {
		return nil, &apptweet.ExternalFetchError{Kind: "unavailable"}
	}
	for _, m := range raw.MediaDetails {
		kind := m.Type
		if kind != "photo" && kind != "video" && kind != "animated_gif" {
			snapshot.Warnings = append(snapshot.Warnings, "部分媒体请在 X 查看")
			continue
		}
		snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: kind, SourceURL: m.URL, Width: m.Original.Width, Height: m.Original.Height, Alt: m.Alt})
	}
	if len(raw.MediaDetails) == 0 {
		for _, m := range raw.Photos {
			snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: "photo", SourceURL: m.URL, Width: m.Width, Height: m.Height})
		}
		if raw.Video != nil {
			snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: "video", SourceURL: raw.Video.Poster})
		}
	}
	result := &apptweet.ExternalFetchResult{SourceID: raw.ID, CanonicalURL: tweet.XCanonicalURL(raw.ID, raw.User.Handle), Snapshot: snapshot, Availability: tweet.ExternalAvailable, FetchSource: "syndication"}
	if raw.QuotedTweet != nil && tweet.ValidXID(raw.QuotedTweet.ID) {
		snapshot.QuoteURL = tweet.XCanonicalURL(raw.QuotedTweet.ID, raw.QuotedTweet.User.Handle)
		if depth == 0 && raw.QuotedTweet.ID != raw.ID {
			result.Quote, err = normalizeSyndication(raw.QuotedTweet, 1)
			if err != nil {
				return nil, err
			}
		}
	}
	return result, nil
}
