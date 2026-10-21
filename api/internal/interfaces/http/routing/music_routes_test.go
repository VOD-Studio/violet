package routing

import (
	"context"
	"fmt"
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
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/infrastructure/kite"
	musichttp "blog-api/internal/interfaces/http/handler/music"
)

type musicRouteRepository struct{ music.Repository }

func (*musicRouteRepository) ListFeatured(context.Context) ([]music.FeaturedPlaylist, error) {
	return []music.FeaturedPlaylist{{Playlist: music.Playlist{ID: "7", Name: "Public"}, Enabled: true}}, nil
}

func (*musicRouteRepository) Credential(context.Context) (music.Credential, error) {
	return music.Credential{}, nil
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
		{"/songs/42", http.StatusOK},
		{"/songs/42/lyric", http.StatusOK},
		{"/playlists/7/tracks", http.StatusOK},
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
	assert.Equal(t, http.StatusOK, request("/songs/42", "203.0.113.11:1234").Code)
	assert.Equal(t, http.StatusOK, request("/songs/42/url", "203.0.113.10:1234").Code, "元数据配额不能消耗独立播放配额")
	assert.Equal(t, http.StatusOK, request("/playlists", "203.0.113.10:1234").Code, "本地展示配置不占上游查询配额")
	assert.Equal(t, http.StatusOK, request("/playback", "203.0.113.10:1234").Code, "本地播放模式不占上游查询配额")
}

func TestPublicMusicPlaybackLimitsPerIPAndAcrossSite(t *testing.T) {
	cache := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { assert.NoError(t, redisClient.Close()) })
	var upstreamCalls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upstreamCalls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/url") {
			_, _ = w.Write([]byte(`{"url":{"id":"42","url":""}}`))
			return
		}
		_, _ = w.Write([]byte(`{"song":{"id":"42","name":"Song","artists":[]}}`))
	}))
	defer upstream.Close()
	deps := fullRouterDeps()
	deps.Redis = redisClient
	deps.Music = musichttp.NewHandler(appmusic.NewService(&musicRouteRepository{}, kite.NewClient(upstream.URL, "token"), nil))
	router := chi.NewRouter()
	RegisterRoutes(router, deps)
	request := func(path, address string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/music"+path, nil)
		req.RemoteAddr = address
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}
	for i := range 20 {
		endpoint, status := "url", http.StatusOK
		if i%2 == 1 {
			endpoint, status = "stream", http.StatusNotFound
		}
		require.Equal(t, status, request(fmt.Sprintf("/songs/%d/%s", i+1, endpoint), "203.0.113.10:1234").Code)
	}
	limited := request("/songs/100/url", "203.0.113.10:1234")
	assert.Equal(t, http.StatusTooManyRequests, limited.Code, "url 与 stream 必须共用 IP 配额")
	assert.Equal(t, "60", limited.Header().Get("Retry-After"))
	assert.Equal(t, int32(20), upstreamCalls.Load())

	for i := range 10 {
		require.Equal(t, http.StatusOK, request(fmt.Sprintf("/songs/%d/url", i+21), "203.0.113.11:1234").Code)
	}
	limited = request("/songs/100/stream", "203.0.113.12:1234")
	assert.Equal(t, http.StatusTooManyRequests, limited.Code, "换 IP 不能绕过全站解析配额")
	assert.Equal(t, "60", limited.Header().Get("Retry-After"))
	assert.Equal(t, int32(30), upstreamCalls.Load(), "被限流的请求不能继续调用 Kite")
	assert.Equal(t, http.StatusOK, request("/songs/42", "203.0.113.10:1234").Code, "播放限流不能阻断元数据")
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

type musicAccountRepository struct {
	musicRouteRepository
	credential music.Credential
}

func (r *musicAccountRepository) Credential(context.Context) (music.Credential, error) {
	return r.credential, nil
}

func TestPublicMusicPlaybackUsesSiteAccountCookieForFeaturedTracks(t *testing.T) {
	box, err := crypto.NewTokenBoxFromSecret("routing-test-credential-key")
	require.NoError(t, err)
	sealed, err := box.Seal("MUSIC_U=site-vip")
	require.NoError(t, err)

	var urlCalls atomic.Int32
	var urlCookieHeader, urlSongID string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "/url"):
			urlCalls.Add(1)
			urlCookieHeader = r.Header.Get("Grpc-Metadata-X-Netease-Cookie")
			urlSongID = strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/v1/songs/"), "/url")
			_, _ = w.Write([]byte(`{"url":{"id":"42","url":"https://audio.example.com/full.mp3","format":"mp3","bitrate":"128000","size":"1200000"}}`))
		case strings.HasSuffix(r.URL.Path, "/tracks"):
			_, _ = w.Write([]byte(`{"songs":[{"id":"42","name":"VIP 曲","durationMs":"230000","fee":1}],"total":1}`))
		default:
			_, _ = w.Write([]byte(`{"song":{"id":"42","name":"VIP 曲","durationMs":"230000","fee":1}}`))
		}
	}))
	defer upstream.Close()

	deps := fullRouterDeps()
	cache := miniredis.RunT(t)
	deps.Redis = redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { assert.NoError(t, deps.Redis.Close()) })
	repo := &musicAccountRepository{credential: music.Credential{
		SealedCookie: sealed,
		Profile:      music.Profile{ID: "9", Nickname: "站点账号"},
	}}
	deps.Music = musichttp.NewHandler(appmusic.NewService(repo, kite.NewClient(upstream.URL, "server-token"), box))
	router := chi.NewRouter()
	RegisterRoutes(router, deps)
	request := func(path string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/music"+path, nil)
		req.Header.Set("Cookie", "violet_session=blog-session")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}

	playback := request("/playback")
	require.Equal(t, http.StatusOK, playback.Code)
	assert.Contains(t, playback.Body.String(), `"mode":"account"`)

	stream := request("/songs/42/stream")
	require.Equal(t, http.StatusFound, stream.Code)
	assert.Equal(t, "https://audio.example.com/full.mp3", stream.Header().Get("Location"))
	assert.Equal(t, "MUSIC_U=site-vip", urlCookieHeader, "站点账号解析必须携带已保存凭据")
	assert.Equal(t, "42", urlSongID)
	require.Equal(t, int32(1), urlCalls.Load())

	again := request("/songs/42/stream")
	require.Equal(t, http.StatusFound, again.Code)
	require.Equal(t, int32(1), urlCalls.Load(), "同曲目解析在缓存窗口内只允许一次上游请求")

	outside := request("/songs/43/stream")
	assert.Equal(t, http.StatusNotFound, outside.Code)
	assert.Equal(t, "42", urlSongID, "展示歌单外的歌曲不得用站点账号解析")
}

func TestPublicMusicTrialSnippetIsDeliveredAndFlagged(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/url") {
			// 480000 字节 / 128000 bit/s ≈ 30 秒，远短于曲目元数据的 230 秒。
			_, _ = w.Write([]byte(`{"url":{"id":"42","url":"https://audio.example.com/trial.mp3","format":"mp3","bitrate":"128000","size":"480000"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"song":{"id":"42","name":"付费曲","durationMs":"230000","fee":4}}`))
	}))
	defer upstream.Close()

	deps := fullRouterDeps()
	cache := miniredis.RunT(t)
	deps.Redis = redis.NewClient(&redis.Options{Addr: cache.Addr()})
	t.Cleanup(func() { assert.NoError(t, deps.Redis.Close()) })
	deps.Music = musichttp.NewHandler(appmusic.NewService(nil, kite.NewClient(upstream.URL, "server-token"), nil))
	router := chi.NewRouter()
	RegisterRoutes(router, deps)
	playback := httptest.NewRequest(http.MethodGet, "/api/v1/music/playback", nil)
	playbackResponse := httptest.NewRecorder()
	router.ServeHTTP(playbackResponse, playback)
	require.Equal(t, http.StatusOK, playbackResponse.Code)
	assert.Contains(t, playbackResponse.Body.String(), `"mode":"anonymous"`)

	urlRequest := httptest.NewRequest(http.MethodGet, "/api/v1/music/songs/42/url", nil)
	urlResponse := httptest.NewRecorder()
	router.ServeHTTP(urlResponse, urlRequest)
	require.Equal(t, http.StatusOK, urlResponse.Code)
	assert.Contains(t, urlResponse.Body.String(), `"trial":true`)
	assert.Contains(t, urlResponse.Body.String(), `"playable":true`)
	assert.Contains(t, urlResponse.Body.String(), "trial.mp3")

	stream := httptest.NewRequest(http.MethodGet, "/api/v1/music/songs/42/stream", nil)
	streamResponse := httptest.NewRecorder()
	router.ServeHTTP(streamResponse, stream)
	assert.Equal(t, http.StatusFound, streamResponse.Code)
	assert.Equal(t, "https://audio.example.com/trial.mp3", streamResponse.Header().Get("Location"))
}
