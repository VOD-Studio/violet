package tweet

import (
	"context"
	"io"
	"strings"
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

type recordingVideoSource struct{ url, byteRange string }

func (v *recordingVideoSource) Open(_ context.Context, url, byteRange string) (*ExternalVideoStream, error) {
	v.url, v.byteRange = url, byteRange
	return &ExternalVideoStream{Status: 206, Body: io.NopCloser(strings.NewReader(""))}, nil
}

func TestOpenExternalVideoOnlyProxiesSnapshotSources(t *testing.T) {
	media := []domaintweet.ExternalMedia{
		{Kind: "photo", SourceURL: "https://pbs.twimg.com/media/a.jpg"},
		{Kind: "animated_gif", VideoURL: "https://video.twimg.com/tweet_video/b.mp4"},
	}
	ext := &domaintweet.ExternalTweet{
		ID: shared.NewID(), SourceID: "2109555352807281003", Availability: domaintweet.ExternalAvailable,
		Snapshot: &domaintweet.ExternalSnapshot{Completeness: domaintweet.TextComplete, Media: media},
	}
	videos := &recordingVideoSource{}
	svc := &Service{external: NewExternalService(&avatarRefreshRepo{external: ext}, nil, nil, nil).WithVideoSource(videos)}

	stream, err := svc.OpenExternalVideo(context.Background(), ext.ID.String(), "1", "bytes=0-")
	require.NoError(t, err)
	assert.Equal(t, 206, stream.Status)
	assert.Equal(t, "https://video.twimg.com/tweet_video/b.mp4", videos.url)
	assert.Equal(t, "bytes=0-", videos.byteRange)

	for _, index := range []string{"0", "2", "-1", "x"} {
		_, err := svc.OpenExternalVideo(context.Background(), ext.ID.String(), index, "")
		require.Error(t, err, index)
	}
	ext.TakenDown = true
	_, err = svc.OpenExternalVideo(context.Background(), ext.ID.String(), "1", "")
	require.Error(t, err)
}
