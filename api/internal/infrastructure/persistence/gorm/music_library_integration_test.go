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
	"blog-api/internal/infrastructure/kite"
	musichttp "blog-api/internal/interfaces/http/handler/music"
)

func TestMusicLibraryIntegrationPublicVisibilityNeverReadsSavedCredential(t *testing.T) {
	ctx := context.Background()
	repo := NewMusicRepository(setupIntegrationDB(t))
	saved, err := repo.ReplaceCredential(ctx, 0, music.Credential{SealedCookie: "intentionally-unreadable", Profile: music.Profile{ID: "99"}})
	require.NoError(t, err)
	require.True(t, saved)
	_, err = repo.AddFeatured(ctx, music.Playlist{ID: "42", Name: "Public"})
	require.NoError(t, err)
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		assert.Empty(t, r.Header.Get("Grpc-Metadata-X-Netease-Cookie"))
		assert.Empty(t, r.Header.Get("Cookie"))
		_, _ = w.Write([]byte(`{"songs":[],"total":0}`))
	}))
	defer server.Close()
	service := appmusic.NewService(repo, kite.NewClient(server.URL, "token"), nil)
	handler := musichttp.NewHandler(service)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /music/playlists/{id}/tracks", handler.PublicTracks)
	read := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodGet, "/music/playlists/42/tracks", nil)
		request.Header.Set("Cookie", "violet_session=blog-session; MUSIC_U=browser-secret")
		request.Header.Set("Grpc-Metadata-X-Netease-Cookie", "injected-secret")
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		return response
	}
	response := read()
	assert.Equal(t, 200, response.Code)
	assert.Contains(t, response.Body.String(), `"data":[]`)
	assert.NotContains(t, response.Body.String(), "secret")
	_, err = service.SetEnabled(ctx, "42", false)
	require.NoError(t, err)
	public, err := service.PublicPlaylists(ctx)
	require.NoError(t, err)
	assert.Empty(t, public)
	assert.NotNil(t, public)
	response = read()
	assert.Equal(t, 404, response.Code)
	assert.Equal(t, int32(1), requests.Load())
}

func TestMusicLibraryIntegrationOrderIsCompleteAndAtomic(t *testing.T) {
	repo := NewMusicRepository(setupIntegrationDB(t))
	ctx := context.Background()
	for _, id := range []string{"1", "2", "3"} {
		_, err := repo.AddFeatured(ctx, music.Playlist{ID: id, Name: id})
		require.NoError(t, err)
	}
	for _, ids := range [][]string{{"3", "1"}, {"3", "3", "1"}, {"3", "1", "99"}} {
		_, err := repo.OrderFeatured(ctx, ids)
		require.Error(t, err)
		all, err := repo.ListFeatured(ctx)
		require.NoError(t, err)
		require.Len(t, all, 3)
		assert.Equal(t, []string{"1", "2", "3"}, []string{all[0].ID, all[1].ID, all[2].ID})
	}
	all, err := repo.OrderFeatured(ctx, []string{"3", "1", "2"})
	require.NoError(t, err)
	assert.Equal(t, []string{"3", "1", "2"}, []string{all[0].ID, all[1].ID, all[2].ID})
	assert.Equal(t, []int{0, 1, 2}, []int{all[0].Position, all[1].Position, all[2].Position})
	_, err = repo.AddFeatured(ctx, music.Playlist{ID: "2"})
	require.Error(t, err)
	require.NoError(t, repo.RemoveFeatured(ctx, "1"))
	all, err = repo.ListFeatured(ctx)
	require.NoError(t, err)
	require.Len(t, all, 2)
	assert.Equal(t, "3", all[0].ID)
	assert.Equal(t, "2", all[1].ID)
}
