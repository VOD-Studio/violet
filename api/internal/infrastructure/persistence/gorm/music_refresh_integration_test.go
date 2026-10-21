package gorm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/domain/music"
	"blog-api/internal/infrastructure/crypto"
	"blog-api/internal/infrastructure/kite"
)

func TestMusicAccountIntegrationRefreshReplacesFullCookieAndDistinguishesExpiry(t *testing.T) {
	repo := NewMusicRepository(setupIntegrationDB(t))
	ctx := context.Background()
	box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
	require.NoError(t, err)
	sealed, err := box.Seal("MUSIC_U=old; obsolete=remove")
	require.NoError(t, err)
	saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: sealed, Profile: music.Profile{ID: "42", Nickname: "Owner"}})
	require.NoError(t, err)
	require.True(t, saved)
	var mode atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/v1/auth/refresh" {
			assert.Equal(t, "MUSIC_U=old; obsolete=remove", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
			_, _ = w.Write([]byte(`{"cookie":"MUSIC_U=fresh; csrf=new"}`))
			return
		}
		assert.Equal(t, "MUSIC_U=fresh; csrf=new", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
		switch mode.Load() {
		case 1:
			w.WriteHeader(401)
			_, _ = w.Write([]byte(`{"details":[{"reason":"LOGIN_REQUIRED"}]}`))
		case 2:
			w.WriteHeader(503)
			_, _ = w.Write([]byte(`{"message":"network failure"}`))
		default:
			_, _ = w.Write([]byte(`{"session":{"userId":"42","nickname":"Owner"}}`))
		}
	}))
	defer server.Close()
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	account, err := service.Refresh(ctx)
	require.NoError(t, err)
	assert.Equal(t, "connected", account.State)
	account, err = service.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "connected", account.State)
	mode.Store(1)
	account, err = service.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "expired", account.State)
	require.NotNil(t, account.Profile)
	assert.Equal(t, "42", account.Profile.ID)
	mode.Store(2)
	_, err = service.Account(ctx)
	require.Error(t, err, "网络错误不能冒充未连接")
}

func TestMusicAccountIntegrationRefreshSurvivesStatusFailure(t *testing.T) {
	repo := NewMusicRepository(setupIntegrationDB(t))
	ctx := context.Background()
	box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
	require.NoError(t, err)
	sealed, err := box.Seal("MUSIC_U=old")
	require.NoError(t, err)
	saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: sealed, Profile: music.Profile{ID: "42", Nickname: "Owner"}})
	require.NoError(t, err)
	require.True(t, saved)

	var statusUnavailable atomic.Bool
	statusUnavailable.Store(true)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/v1/auth/refresh" {
			_, _ = w.Write([]byte(`{"cookie":"MUSIC_U=fresh"}`))
			return
		}
		if statusUnavailable.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		if r.Header.Get("Grpc-Metadata-X-Netease-Cookie") != "MUSIC_U=fresh" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"details":[{"reason":"LOGIN_REQUIRED"}]}`))
			return
		}
		_, _ = w.Write([]byte(`{"session":{"userId":"42","nickname":"Owner"}}`))
	}))
	defer server.Close()
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	_, err = service.Refresh(ctx)
	require.Error(t, err, "后续状态检查失败不能伪造已确认的账号状态")
	statusUnavailable.Store(false)
	account, err := service.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "connected", account.State, "状态服务恢复后必须能使用已续期 Cookie")
	require.NotNil(t, account.Profile)
	assert.Equal(t, "42", account.Profile.ID)
}

func TestMusicAccountIntegrationAutomaticRefreshKeepsExpiredAccountVisible(t *testing.T) {
	repo := NewMusicRepository(setupIntegrationDB(t))
	ctx := context.Background()
	box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
	require.NoError(t, err)
	sealed, err := box.Seal("MUSIC_U=expired")
	require.NoError(t, err)
	saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: sealed, Profile: music.Profile{ID: "42", Nickname: "Owner"}})
	require.NoError(t, err)
	require.True(t, saved)
	_, err = repo.AddFeatured(ctx, music.Playlist{ID: "7", Name: "Public"})
	require.NoError(t, err)

	var renewable atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/playlists/7/tracks":
			_, _ = w.Write([]byte(`{"songs":[{"id":"42","name":"Song"}],"total":1}`))
		case "/api/v1/songs/42/url":
			if r.Header.Get("Grpc-Metadata-X-Netease-Cookie") == "" {
				_, _ = w.Write([]byte(`{"url":{"id":"42","url":"https://audio.example.com/free.mp3"}}`))
			} else {
				_, _ = w.Write([]byte(`{"url":{"id":"42","url":"https://audio.example.com/account.mp3"}}`))
			}
		case "/api/v1/auth/refresh":
			assert.Equal(t, "MUSIC_U=expired", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
			if renewable.Load() {
				_, _ = w.Write([]byte(`{"cookie":"MUSIC_U=recovered"}`))
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"details":[{"reason":"LOGIN_REQUIRED"}]}`))
		case "/api/v1/auth/status":
			assert.True(t, renewable.Load(), "失效期间不能反复请求上游状态")
			assert.Equal(t, "MUSIC_U=recovered", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
			_, _ = w.Write([]byte(`{"session":{"userId":"42","nickname":"Owner"}}`))
		default:
			t.Errorf("确认失效后不应再探测上游状态: %s", r.URL.Path)
			w.WriteHeader(http.StatusServiceUnavailable)
		}
	}))
	defer server.Close()
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	before, err := service.SongURL(ctx, "42", "standard")
	require.NoError(t, err)
	require.NotNil(t, before.URL)
	assert.Equal(t, "https://audio.example.com/account.mp3", *before.URL)

	err = service.RefreshIfConnected(ctx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "重新扫码")
	restarted := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	account, err := restarted.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "expired", account.State, "失效状态必须持久化，不能因重启丢失")
	require.NotNil(t, account.Profile)
	assert.Equal(t, "42", account.Profile.ID)
	playback, err := restarted.Playback(ctx)
	require.NoError(t, err)
	assert.Equal(t, "anonymous", playback.Mode)
	songURL, err := service.SongURL(ctx, "42", "standard")
	require.NoError(t, err)
	require.NotNil(t, songURL.URL)
	assert.Equal(t, "https://audio.example.com/free.mp3", *songURL.URL, "失效后必须丢弃旧账号播放缓存并匿名解析")
	assert.True(t, songURL.Playable)
	renewable.Store(true)
	account, err = service.Refresh(ctx)
	require.NoError(t, err)
	assert.Equal(t, "connected", account.State)
	playback, err = restarted.Playback(ctx)
	require.NoError(t, err)
	assert.Equal(t, "account", playback.Mode, "手动恢复必须清除数据库中的失效标记")
}

func TestMusicAccountIntegrationAutomaticRefreshCannotReplaceNewAccount(t *testing.T) {
	for _, result := range []string{"renewed", "expired"} {
		t.Run(result, func(t *testing.T) {
			repo := NewMusicRepository(setupIntegrationDB(t))
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
			require.NoError(t, err)
			oldCookie, err := box.Seal("MUSIC_U=old")
			require.NoError(t, err)
			saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: oldCookie, Profile: music.Profile{ID: "42"}})
			require.NoError(t, err)
			require.True(t, saved)

			entered, release := make(chan struct{}), make(chan struct{})
			unblock := sync.OnceFunc(func() { close(release) })
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				switch r.URL.Path {
				case "/api/v1/auth/refresh":
					assert.Equal(t, "MUSIC_U=old", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
					close(entered)
					select {
					case <-release:
						if result == "expired" {
							w.WriteHeader(http.StatusUnauthorized)
							_, _ = w.Write([]byte(`{"details":[{"reason":"LOGIN_REQUIRED"}]}`))
							return
						}
						_, _ = w.Write([]byte(`{"cookie":"MUSIC_U=stale-renewal"}`))
					case <-r.Context().Done():
					}
				case "/api/v1/auth/status":
					assert.Equal(t, "MUSIC_U=new-account", r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
					_, _ = w.Write([]byte(`{"session":{"userId":"99","nickname":"New Owner"}}`))
				default:
					t.Errorf("unexpected request: %s", r.URL.Path)
					w.WriteHeader(http.StatusNotFound)
				}
			}))
			defer server.Close()
			defer unblock()
			service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
			done := make(chan error, 1)
			go func() { done <- service.RefreshIfConnected(ctx) }()
			select {
			case <-entered:
			case <-ctx.Done():
				t.Fatal("自动续期未发起上游请求")
			}

			newCookie, err := box.Seal("MUSIC_U=new-account")
			require.NoError(t, err)
			saved, err = repo.ReplaceCredential(ctx, 1, music.Credential{SealedCookie: newCookie, Profile: music.Profile{ID: "99"}})
			require.NoError(t, err)
			require.True(t, saved)
			unblock()
			require.Error(t, <-done, "换号后迟到的自动续期必须被拒绝")
			account, err := service.Account(ctx)
			require.NoError(t, err)
			assert.Equal(t, "connected", account.State)
			require.NotNil(t, account.Profile)
			assert.Equal(t, "99", account.Profile.ID)
		})
	}
}
