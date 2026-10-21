package gorm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

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
