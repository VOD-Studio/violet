package tweet

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

type countingFetcher struct {
	result *ExternalFetchResult
	calls  int
}

func (f *countingFetcher) Fetch(context.Context, string) (*ExternalFetchResult, error) {
	f.calls++
	return f.result, nil
}

func TestLoadRefetchesRecentSnapshotMissingVideoSource(t *testing.T) {
	gif := func(videoURL string) []domaintweet.ExternalMedia {
		return []domaintweet.ExternalMedia{{Kind: "animated_gif", SourceURL: "https://pbs.twimg.com/tweet_video_thumb/a.jpg", VideoURL: videoURL}}
	}
	snapshot := func(videoURL string) *domaintweet.ExternalSnapshot {
		return &domaintweet.ExternalSnapshot{Author: domaintweet.ExternalAuthor{Name: "author"}, Text: "gif", Completeness: domaintweet.TextComplete, Media: gif(videoURL)}
	}
	for _, tc := range []struct {
		name      string
		stored    string
		wantCalls int
	}{
		{"legacy_poster_only", "", 1},
		{"has_video_source", "https://video.twimg.com/tweet_video/a.mp4", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fetcher := &countingFetcher{result: &ExternalFetchResult{
				SourceID: "2109555352807281003", CanonicalURL: "https://x.com/i/status/2109555352807281003",
				Availability: domaintweet.ExternalAvailable, FetchSource: "fxtwitter",
				Snapshot: snapshot("https://video.twimg.com/tweet_video/a.mp4"),
			}}
			repo := &avatarRefreshRepo{external: &domaintweet.ExternalTweet{
				ID: shared.NewID(), SourceID: "2109555352807281003", Version: uuid.NewString(),
				Snapshot: snapshot(tc.stored), Availability: domaintweet.ExternalAvailable, FetchedAt: time.Now(),
			}}
			svc := NewExternalService(repo, fetcher, avatarRefreshMedia{}, avatarRefreshPreviews{})
			ext, err := svc.load(context.Background(), "2109555352807281003", false)
			require.NoError(t, err)
			assert.Equal(t, tc.wantCalls, fetcher.calls)
			assert.Equal(t, "https://video.twimg.com/tweet_video/a.mp4", ext.Snapshot.Media[0].VideoURL)
		})
	}
}
