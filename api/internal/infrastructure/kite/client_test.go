package kite_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/kite"
)

func TestPublicMusicNeverForwardsAccountCookie(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer service-secret", r.Header.Get("Authorization"))
		assert.Empty(t, r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
		assert.Empty(t, r.Header.Get("Cookie"))
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/songs/42":
			_, _ = w.Write([]byte(`{"song":{"id":"42","name":"Song","durationMs":"180000","artists":[],"album":{"id":"8","name":"Album","picUrl":"https://p1.music.126.net/cover.jpg"}}}`))
		case "/api/v1/songs/42/url":
			assert.Equal(t, "SONG_LEVEL_STANDARD", r.URL.Query().Get("level"))
			_, _ = w.Write([]byte(`{"url":{"id":"42","url":"","bitrate":"0","size":"0","format":""}}`))
		case "/api/v1/songs/42/lyric":
			_, _ = w.Write([]byte(`{"lyric":{"lrc":"[00:00]song"}}`))
		case "/api/v1/playlists/42":
			_, _ = w.Write([]byte(`{"playlist":{"id":"42","name":"Public","coverUrl":"https://p1.music.126.net/a.jpg","trackCount":1,"creator":{"nickname":"Creator"}}}`))
		case "/api/v1/playlists/42/tracks", "/api/v1/search":
			_, _ = w.Write([]byte(`{"songs":[],"playlists":[],"total":0}`))
		default:
			t.Errorf("unexpected route %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	client := kite.NewClient(server.URL, "service-secret")
	ctx := context.Background()
	song, err := client.Song(ctx, "42")
	require.NoError(t, err)
	assert.Equal(t, int64(180000), song.DurationMS)
	assert.NotNil(t, song.Artists)
	playback, err := client.SongURL(ctx, "42", "", "standard")
	require.NoError(t, err)
	assert.False(t, playback.Playable)
	assert.Nil(t, playback.URL)
	_, err = client.Lyric(ctx, "42")
	require.NoError(t, err)
	playlist, err := client.Playlist(ctx, "42")
	require.NoError(t, err)
	assert.Equal(t, "Creator", playlist.Creator)
	_, err = client.Tracks(ctx, "42", "", shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	_, err = client.SearchSongs(ctx, "test", shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	_, err = client.SearchPlaylists(ctx, "test", shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
}

func TestKiteErrorsDistinguishServiceTokenFromNeteaseLogin(t *testing.T) {
	for _, reason := range []string{"SERVER_AUTH_FAILED", "LOGIN_REQUIRED"} {
		t.Run(reason, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusUnauthorized)
				_ = json.NewEncoder(w).Encode(map[string]any{"message": "secret-cookie-and-token", "details": []map[string]string{{"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": reason}}})
			}))
			defer server.Close()
			_, err := kite.NewClient(server.URL, "service-secret").Account(context.Background(), "MUSIC_U=private")
			var providerErr *appmusic.ProviderError
			require.ErrorAs(t, err, &providerErr)
			assert.Equal(t, reason, providerErr.Reason)
			assert.NotContains(t, err.Error(), "secret")
			assert.NotContains(t, err.Error(), "MUSIC_U")
		})
	}
}
func TestKiteVerificationChecksAuthenticatedEndpoint(t *testing.T) {
	var authenticated atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			_, _ = w.Write([]byte("ok"))
			return
		}
		authenticated.Store(true)
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"details":[{"reason":"SERVER_AUTH_FAILED"}]}`))
	}))
	defer server.Close()
	err := kite.NewClient(server.URL, "invalid").Verify(context.Background())
	require.Error(t, err)
	assert.True(t, authenticated.Load())
}

func TestHiResPlaybackUsesProviderQuality(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("level") != "SONG_LEVEL_HRES" {
			http.Error(w, "invalid song level", http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"url":{"id":"42","url":"https://music.126.net/song.flac","format":"flac","bitrate":"960000","size":"1024"}}`))
	}))
	defer server.Close()

	playback, err := kite.NewClient(server.URL, "service-secret").SongURL(context.Background(), "42", "", "hires")
	require.NoError(t, err)
	require.True(t, playback.Playable)
	assert.Equal(t, "flac", playback.Format)
	assert.Equal(t, int64(960000), playback.Bitrate)
}
