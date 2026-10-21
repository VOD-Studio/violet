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
	paths := []struct {
		path   string
		status int
	}{
		{"/songs/42/url", http.StatusOK},
		{"/songs/42", http.StatusOK},
		{"/songs/42/lyric", http.StatusOK},
		{"/playlists/7/tracks", http.StatusOK},
		{"/songs/42/stream", http.StatusNotFound},
	}
	for i := range 60 {
		test := paths[i%len(paths)]
		require.Equal(t, test.status, request(test.path, "203.0.113.10:1234").Code)
	}
	for _, test := range paths {
		response := request(test.path, "203.0.113.10:1234")
		assert.Equal(t, http.StatusTooManyRequests, response.Code, test.path)
		assert.Equal(t, "60", response.Header().Get("Retry-After"))
	}
	assert.Equal(t, int32(60), upstreamCalls.Load(), "被限流的请求不能继续调用 Kite")
	assert.Equal(t, http.StatusOK, request("/songs/42/url", "203.0.113.11:1234").Code)
	assert.Equal(t, http.StatusOK, request("/playlists", "203.0.113.10:1234").Code, "本地展示配置不占上游查询配额")
}

func TestPublicMusicStreamRedirectsOnlyToAnonymousPlayableURLs(t *testing.T) {
	for _, test := range []struct {
		name   string
		url    string
		status int
	}{
		{"available", "https://audio.example.com/song.mp3?key=public", http.StatusFound},
		{"unavailable", "", http.StatusNotFound},
		{"unsafe_url", "http://127.0.0.1/private", http.StatusNotFound},
	} {
		t.Run(test.name, func(t *testing.T) {
			cache := miniredis.RunT(t)
			redisClient := redis.NewClient(&redis.Options{Addr: cache.Addr()})
			t.Cleanup(func() { assert.NoError(t, redisClient.Close()) })
			outbound := make(chan http.Header, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				outbound <- r.Header.Clone()
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"url":{"id":"42","url":"` + test.url + `"}}`))
			}))
			defer upstream.Close()
			deps := fullRouterDeps()
			deps.Redis = redisClient
			deps.Music = musichttp.NewHandler(appmusic.NewService(nil, kite.NewClient(upstream.URL, "server-token"), nil))
			router := chi.NewRouter()
			RegisterRoutes(router, deps)
			request := httptest.NewRequest(http.MethodGet, "/api/v1/music/songs/42/stream", nil)
			request.Header.Set("Cookie", "violet_session=blog-session")
			request.Header.Set("Grpc-Metadata-X-Netease-Cookie", "browser-cookie")
			result := httptest.NewRecorder()
			router.ServeHTTP(result, request)
			require.Equal(t, test.status, result.Code)
			require.Equal(t, "no-store", result.Header().Get("Cache-Control"))
			if test.status == http.StatusFound {
				assert.Equal(t, test.url, result.Header().Get("Location"))
			} else {
				assert.Empty(t, result.Header().Get("Location"))
			}
			assert.Empty(t, result.Header().Values("Set-Cookie"))
			assert.NotContains(t, result.Body.String(), "server-token")
			assert.NotContains(t, result.Body.String(), "browser-cookie")
			var headers http.Header
			select {
			case headers = <-outbound:
			default:
				t.Fatal("请求未进入匿名 Kite 解析链路")
			}
			assert.Equal(t, "Bearer server-token", headers.Get("Authorization"))
			assert.Empty(t, headers.Get("Cookie"))
			assert.Empty(t, headers.Get("Grpc-Metadata-X-Netease-Cookie"))
		})
	}
}
