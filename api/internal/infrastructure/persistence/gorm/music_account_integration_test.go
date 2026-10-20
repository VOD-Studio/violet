package gorm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

func TestMusicAccountIntegrationChallengeOwnershipCancellationAndConsumption(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	entered, release := make(chan struct{}, 1), make(chan struct{})
	var block atomic.Bool
	var checks atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/auth/login/qrcode":
			_, _ = w.Write([]byte(`{"qrcode":{"key":"remote-key","url":"https://music.163.com/login?codekey=remote-key"}}`))
		case "/api/v1/auth/login/qrcode/check":
			checks.Add(1)
			if block.Load() {
				entered <- struct{}{}
				<-release
			}
			_, _ = w.Write([]byte(`{"code":"QRCODE_CODE_CONFIRMED","session":{"userId":"42","cookie":"MUSIC_U=private-cookie","nickname":"Owner","avatarUrl":"https://p1.music.126.net/a.jpg"}}`))
		case "/api/v1/auth/status":
			_, _ = w.Write([]byte(`{"session":{"userId":"42","nickname":"Owner"}}`))
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
	require.NoError(t, err)
	repo := NewMusicRepository(db)
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	challenge, err := service.LoginQR(ctx, "alice")
	require.NoError(t, err)
	result, err := service.CheckQR(ctx, challenge.ID, "bob")
	require.NoError(t, err)
	assert.Equal(t, "expired", result.State)
	assert.Zero(t, checks.Load())
	require.NoError(t, service.CancelQR(ctx, challenge.ID, "bob"))
	result, err = service.CheckQR(ctx, challenge.ID, "alice")
	require.NoError(t, err)
	assert.Equal(t, "confirmed", result.State)
	encoded, err := json.Marshal(result)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "private-cookie")
	assert.NotContains(t, string(encoded), "remote-key")
	result, err = service.CheckQR(ctx, challenge.ID, "alice")
	require.NoError(t, err)
	assert.Equal(t, "expired", result.State)
	assert.Equal(t, int32(1), checks.Load())

	challenge, err = service.LoginQR(ctx, "alice")
	require.NoError(t, err)
	block.Store(true)
	type outcome struct {
		check appmusic.CheckDTO
		err   error
	}
	done := make(chan outcome, 1)
	go func() { result, err := service.CheckQR(ctx, challenge.ID, "alice"); done <- outcome{result, err} }()
	<-entered
	require.NoError(t, service.CancelQR(ctx, challenge.ID, "alice"))
	close(release)
	checked := <-done
	require.NoError(t, checked.err)
	assert.Equal(t, "expired", checked.check.State)
	account, err := service.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "connected", account.State)
}

func TestMusicAccountIntegrationLogoutDefeatsInflightRefreshAndOldQR(t *testing.T) {
	db := setupIntegrationDB(t)
	ctx := context.Background()
	entered, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/api/v1/auth/login/qrcode":
			_, _ = w.Write([]byte(`{"qrcode":{"key":"key","url":"https://music.163.com/login?codekey=key"}}`))
		case "/api/v1/auth/refresh":
			close(entered)
			<-release
			_, _ = w.Write([]byte(`{"cookie":"MUSIC_U=fresh"}`))
		case "/api/v1/auth/status":
			_, _ = w.Write([]byte(`{"session":{"userId":"42","nickname":"Owner"}}`))
		case "/api/v1/auth/logout":
			w.WriteHeader(503)
			_, _ = w.Write([]byte(`{"message":"upstream failed"}`))
		default:
			t.Errorf("unexpected call after logout: %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	box, err := crypto.NewTokenBoxFromSecret("test-only-credential-key-32-characters")
	require.NoError(t, err)
	sealed, err := box.Seal("MUSIC_U=old")
	require.NoError(t, err)
	repo := NewMusicRepository(db)
	saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: sealed, Profile: music.Profile{ID: "42"}})
	require.NoError(t, err)
	require.True(t, saved)
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), box)
	challenge, err := service.LoginQR(ctx, "alice")
	require.NoError(t, err)
	done := make(chan error, 1)
	go func() { _, err := service.Refresh(ctx); done <- err }()
	<-entered
	err = service.Logout(ctx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "本站连接已清除")
	close(release)
	require.Error(t, <-done)
	account, err := service.Account(ctx)
	require.NoError(t, err)
	assert.Equal(t, "disconnected", account.State)
	assert.Nil(t, account.Profile)
	result, err := service.CheckQR(ctx, challenge.ID, "alice")
	require.NoError(t, err)
	assert.Equal(t, "expired", result.State)
}

func TestMusicAccountIntegrationExpiredChallengeCannotConnect(t *testing.T) {
	repo := NewMusicRepository(setupIntegrationDB(t))
	ctx := context.Background()
	challenge := music.Challenge{ID: "expired", OwnerID: "alice", Key: "key", ExpiresAt: time.Now().Add(-time.Minute)}
	require.NoError(t, repo.CreateChallenge(ctx, challenge))
	saved, err := repo.ConfirmChallenge(ctx, challenge, music.Credential{SealedCookie: "sealed", Profile: music.Profile{ID: "42"}})
	require.NoError(t, err)
	assert.False(t, saved)
	found, err := repo.FindChallenge(ctx, challenge.ID, "alice")
	require.NoError(t, err)
	assert.Nil(t, found)
}
