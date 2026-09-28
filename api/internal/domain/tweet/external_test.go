package tweet

import (
	"blog-api/internal/domain/shared"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestParseXURL(t *testing.T) {
	for _, raw := range []string{
		"https://x.com/jack/status/20?s=20", "https://twitter.com/i/status/20", "https://www.x.com/i/web/status/20",
		"https://mobile.twitter.com/other/status/20/photo/1", "https://mobile.x.com/name/status/20/video/2#player", "https://x.com:443/name/status/20/",
	} {
		id, err := ParseXURL(raw)
		require.NoError(t, err, raw)
		require.Equal(t, "20", id)
	}
	for _, raw := range []string{
		"http://x.com/jack/status/20", "https://x.com.evil.test/jack/status/20", "https://x.com@127.0.0.1/jack/status/20", "https://name@x.com/jack/status/20",
		"https://x.com:8443/jack/status/20", "https://t.co/short", "https://x.com/jack", "https://x.com/jack/status/2e20", "https://x.com/jack/status/123456789012345678901",
		"https://x.com/i/web/status/20/anything", "https://x.com/%69/status/20", "https://127.0.0.1/i/status/20", "https://x.com/jack/status/00020", "https://x.com/i/status/20/photo/0",
	} {
		_, err := ParseXURL(raw)
		require.Error(t, err, raw)
	}
}

func TestExternalTweetRulesAndNotification(t *testing.T) {
	source := shared.NewID()
	tweet, err := NewTweet(shared.NewID(), "", nil, nil, Publication{ExternalTweetID: &source})
	require.NoError(t, err)
	require.Equal(t, "转发了一条 X 推文", tweet.NotificationExcerpt())
	quote := shared.NewID()
	_, err = NewTweet(shared.NewID(), "", nil, &quote, Publication{ExternalTweetID: &source})
	require.Error(t, err)
}
