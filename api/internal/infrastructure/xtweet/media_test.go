package xtweet

import (
	"bytes"
	"context"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/tweet"
	infraimage "blog-api/internal/infrastructure/image"
)

func mediaPNG(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 64, 48))))
	return buf.Bytes()
}

func mediaResponse(body []byte, mime string) *http.Response {
	return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {mime}}, Body: io.NopCloser(bytes.NewReader(body)), ContentLength: int64(len(body))}
}

func TestMediaStoreSavesOriginalsPostersAndLocalAvatarWithBoundedConcurrency(t *testing.T) {
	root, id, version := t.TempDir(), uuid.NewString(), uuid.NewString()
	body := mediaPNG(t)
	var active, peak atomic.Int32
	store := NewMediaStore(root, "/uploads", infraimage.NewProcessor(root, "/uploads"), &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		assert.Equal(t, "pbs.twimg.com", req.URL.Hostname())
		assert.Empty(t, req.Header.Get("Authorization"))
		assert.Empty(t, req.Header.Get("Cookie"))
		if strings.HasPrefix(req.URL.Path, "/media/") {
			assert.Equal(t, "orig", req.URL.Query().Get("name"))
		}
		n := active.Add(1)
		for previous := peak.Load(); n > previous && !peak.CompareAndSwap(previous, n); previous = peak.Load() {
		}
		time.Sleep(10 * time.Millisecond)
		active.Add(-1)
		return mediaResponse(body, "image/png"), nil
	})})
	snapshot := &tweet.ExternalSnapshot{Author: tweet.ExternalAuthor{AvatarSourceURL: "https://pbs.twimg.com/profile_images/avatar.png"}}
	for range 4 {
		snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: "photo", SourceURL: "https://pbs.twimg.com/media/photo.png?name=small"})
	}
	snapshot.Media = append(snapshot.Media, tweet.ExternalMedia{Kind: "video", SourceURL: "https://pbs.twimg.com/ext_tw_video_thumb/poster.png"})
	var total int64
	require.NoError(t, store.Prepare(context.Background(), id, version, snapshot, &total))
	assert.LessOrEqual(t, peak.Load(), int32(3))
	assert.Greater(t, peak.Load(), int32(1))
	assert.EqualValues(t, len(body)*6, total)
	assert.True(t, strings.HasPrefix(snapshot.Author.AvatarURL, "/uploads/external-tweets/"))
	for _, media := range snapshot.Media {
		assert.Equal(t, 64, media.Width)
		assert.Equal(t, 48, media.Height)
		assert.NotEmpty(t, media.ThumbnailURL)
		data, err := os.ReadFile(filepath.Join(root, strings.TrimPrefix(media.URL, "/uploads/")))
		require.NoError(t, err)
		assert.Equal(t, body, data)
	}
	require.NoError(t, store.DeleteAll(context.Background(), id))
	_, err := os.Stat(filepath.Join(root, "external-tweets", id))
	assert.True(t, os.IsNotExist(err))
}

func TestMediaStoreRejectsUnsafeInvalidOversizedAndPixelBombs(t *testing.T) {
	body := mediaPNG(t)
	pixelBomb := append([]byte{}, body...)
	binary.BigEndian.PutUint32(pixelBomb[16:20], 50000)
	binary.BigEndian.PutUint32(pixelBomb[20:24], 50000)
	binary.BigEndian.PutUint32(pixelBomb[29:33], crc32.ChecksumIEEE(pixelBomb[12:29]))
	for _, tc := range []struct {
		name, url, mime string
		body            []byte
		initial         int64
	}{
		{"wrong_host", "https://evil.test/a.png", "image/png", body, 0},
		{"userinfo", "https://user@pbs.twimg.com/a.png", "image/png", body, 0},
		{"fake_image", "https://pbs.twimg.com/a.png", "image/png", []byte("<html>fake</html>"), 0},
		{"wrong_mime", "https://pbs.twimg.com/a.png", "text/html", body, 0},
		{"truncated", "https://pbs.twimg.com/a.png", "image/png", body[:40], 0},
		{"bytes", "https://pbs.twimg.com/a.png", "image/png", make([]byte, maxImageBytes+1), 0},
		{"pixels", "https://pbs.twimg.com/a.png", "image/png", pixelBomb, 0},
		{"whole_import", "https://pbs.twimg.com/a.png", "image/png", body, maxImportBytes - 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root, id, version := t.TempDir(), uuid.NewString(), uuid.NewString()
			store := NewMediaStore(root, "/uploads", infraimage.NewProcessor(root, "/uploads"), &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) { return mediaResponse(tc.body, tc.mime), nil })})
			snapshot := &tweet.ExternalSnapshot{Media: []tweet.ExternalMedia{{Kind: "photo", SourceURL: tc.url}}}
			total := tc.initial
			require.Error(t, store.Prepare(context.Background(), id, version, snapshot, &total))
			_, err := os.Stat(filepath.Join(root, "external-tweets", id, version))
			assert.True(t, os.IsNotExist(err))
			files, err := os.ReadDir(filepath.Join(root, ".external-tmp"))
			require.NoError(t, err)
			assert.Empty(t, files)
		})
	}
}

func TestMediaStoreOptionalAvatarAndCleanupProtectCurrentVersion(t *testing.T) {
	root, id, version := t.TempDir(), uuid.NewString(), uuid.NewString()
	store := NewMediaStore(root, "/uploads", infraimage.NewProcessor(root, "/uploads"), &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) { return mediaResponse([]byte("invalid"), "image/png"), nil })})
	snapshot := &tweet.ExternalSnapshot{Author: tweet.ExternalAuthor{AvatarSourceURL: "https://pbs.twimg.com/avatar.png"}}
	var total int64
	require.NoError(t, store.Prepare(context.Background(), id, version, snapshot, &total))
	assert.Empty(t, snapshot.Author.AvatarURL)
	assert.Contains(t, snapshot.Warnings, "原作者头像暂不可用")
	files, err := os.ReadDir(filepath.Join(root, "external-tweets", id, version))
	require.NoError(t, err)
	assert.Empty(t, files)
	old := uuid.NewString()
	oldPath := filepath.Join(root, "external-tweets", id, old)
	require.NoError(t, os.MkdirAll(oldPath, 0o755))
	before := time.Now().Add(-24 * time.Hour)
	require.NoError(t, os.Chtimes(oldPath, before.Add(-time.Hour), before.Add(-time.Hour)))
	require.NoError(t, store.Sweep(context.Background(), map[string]string{id: version}, before))
	_, err = os.Stat(oldPath)
	assert.True(t, os.IsNotExist(err))
	_, err = os.Stat(filepath.Join(root, "external-tweets", id, version))
	require.NoError(t, err)
}
