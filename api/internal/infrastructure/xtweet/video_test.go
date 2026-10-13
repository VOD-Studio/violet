package xtweet

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVideoSourceStreamsWithoutRefererAndForwardsSingleRange(t *testing.T) {
	const source = "https://video.twimg.com/tweet_video/a.mp4"
	var seen []*http.Request
	videos := NewVideoSource(&http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		seen = append(seen, req)
		status, header := http.StatusOK, http.Header{"Content-Type": {"video/mp4"}, "Content-Length": {"4"}}
		if req.Header.Get("Range") != "" {
			status = http.StatusPartialContent
			header.Set("Content-Range", "bytes 2-3/4")
		}
		return &http.Response{StatusCode: status, Header: header, Body: io.NopCloser(bytes.NewReader([]byte("mp4!")))}, nil
	})})

	stream, err := videos.Open(context.Background(), source, "bytes=2-")
	require.NoError(t, err)
	body, err := io.ReadAll(stream.Body)
	require.NoError(t, err)
	require.NoError(t, stream.Body.Close())
	assert.Equal(t, http.StatusPartialContent, stream.Status)
	assert.Equal(t, "bytes 2-3/4", stream.ContentRange)
	assert.Equal(t, "mp4!", string(body))
	assert.Empty(t, seen[0].Header.Get("Referer"))
	assert.Equal(t, "bytes=2-", seen[0].Header.Get("Range"))

	for _, unsafe := range []string{"bytes=0-1,5-6", "bytes=-", "items=0-"} {
		stream, err := videos.Open(context.Background(), source, unsafe)
		require.NoError(t, err)
		_ = stream.Body.Close()
		assert.Empty(t, seen[len(seen)-1].Header.Get("Range"), unsafe)
	}

	_, err = videos.Open(context.Background(), "https://evil.example/a.mp4", "")
	require.Error(t, err)
}

func TestVideoSourceRejectsUpstreamFailures(t *testing.T) {
	videos := NewVideoSource(&http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusForbidden, Header: http.Header{}, Body: io.NopCloser(bytes.NewReader(nil))}, nil
	})})
	_, err := videos.Open(context.Background(), "https://video.twimg.com/tweet_video/a.mp4", "")
	require.Error(t, err)
}
