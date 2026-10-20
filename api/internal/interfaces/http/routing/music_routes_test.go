package routing

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/music"
	"blog-api/internal/infrastructure/kite"
	musichttp "blog-api/internal/interfaces/http/handler/music"
)

type musicRouteRepository struct{ music.Repository }

func (*musicRouteRepository) ListFeatured(context.Context) ([]music.FeaturedPlaylist, error) {
	return []music.FeaturedPlaylist{{Playlist: music.Playlist{ID: "7", Name: "Public"}, Enabled: true}}, nil
}

func TestPublicMusicQueriesSharePerIPLimit(t *testing.T) {
	cache := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { assert.NoError(t, redisClient.Close()) })
	var upstreamCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/url"):
			_, _ = w.Write([]byte(`{"url":{"id":"42","url":"","format":"","bitrate":"0","size":"0"}}`))
		case strings.HasSuffix(r.URL.Path, "/lyric"):
			_, _ = w.Write([]byte(`{"lyric":{"lrc":"line"}}`))
		case strings.HasSuffix(r.URL.Path, "/tracks"):
			_, _ = w.Write([]byte(`{"songs":[],"total":0}`))
		default:
			_, _ = w.Write([]byte(`{"song":{"id":"42","name":"Song","artists":[]}}`))
		}
	}))
	defer upstream.Close()
	deps := fullRouterDeps()
	deps.Redis = redisClient
	deps.Music = musichttp.NewHandler(appmusic.NewService(&musicRouteRepository{}, kite.NewClient(upstream.URL, "token"), nil))
	router := chi.NewRouter()
	RegisterRoutes(router, deps)
	request := func(path, address string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/music"+path, nil)
		req.RemoteAddr = address
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	paths := []string{"/songs/42/url", "/songs/42", "/songs/42/lyric", "/playlists/7/tracks"}
	for i := range 60 {
		require.Equal(t, http.StatusOK, request(paths[i%len(paths)], "203.0.113.10:1234").Code)
	}
	for _, path := range paths {
		response := request(path, "203.0.113.10:1234")
		assert.Equal(t, http.StatusTooManyRequests, response.Code, path)
		assert.Equal(t, "60", response.Header().Get("Retry-After"))
	}
	assert.Equal(t, int32(60), upstreamCalls.Load(), "被限流的请求不能继续调用 Kite")
	assert.Equal(t, http.StatusOK, request("/songs/42/url", "203.0.113.11:1234").Code)
	assert.Equal(t, http.StatusOK, request("/playlists", "203.0.113.10:1234").Code, "本地展示配置不占上游查询配额")
}
