package friendlink

import (
	"testing"

	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestRSSURLIsOptionalAndValidatedBeforePersistence(t *testing.T) {
	for _, rss := range []string{"", "https://friend.example/feed.xml", "https://friend.example/atom"} {
		link, err := NewFriendLink(CreateParams{ID: shared.NewID(), Name: "站点", URL: "https://friend.example", ContactEmail: "reader@example.com", RSSURL: rss})
		require.NoError(t, err)
		require.Equal(t, rss, link.RSSURL())
		require.False(t, link.IsApproved())
		require.Nil(t, link.Activity().LatestPublishedAt)
		if rss == "" {
			require.Equal(t, FeedNone, link.Activity().FeedStatus)
		}
	}
	for _, rss := range []string{"javascript:alert(1)", "file:///etc/passwd", "http://127.0.0.1/feed", "http://[::1]/feed", "http://169.254.169.254/feed", "https://reader@friend.example/feed", "https://friend.example/feed#fragment"} {
		_, err := NewFriendLink(CreateParams{ID: shared.NewID(), Name: "站点", URL: "https://friend.example", ContactEmail: "reader@example.com", RSSURL: rss})
		require.Error(t, err, rss)
	}
}
