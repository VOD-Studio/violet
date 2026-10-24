package apitoken

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	appapitoken "blog-api/internal/application/api_token"
	appshared "blog-api/internal/application/shared"
	domainapitoken "blog-api/internal/domain/api_token"
	inframcp "blog-api/internal/infrastructure/mcp"
	persist "blog-api/internal/infrastructure/persistence/gorm"
	"blog-api/internal/infrastructure/persistence/gorm/model"
	"blog-api/internal/middleware"
)

func setupUpdateHandler(t *testing.T) (*Handler, *persist.APITokenRepository, *domainapitoken.PAT, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "tokens.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.APIToken{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	created := time.Date(2020, 1, 1, 0, 0, 0, 123456789, time.UTC)
	raw := "violet_pat_original-plaintext"
	p := domainapitoken.Reconstruct("00000000-0000-0000-0000-000000000001", "owner", "原名", domainapitoken.HashToken(raw),
		[]string{domainapitoken.ScopePostsRead}, created.Add(time.Hour), created.Add(time.Minute), created, true)
	repo := persist.NewAPITokenRepository(db)
	require.NoError(t, repo.Save(context.Background(), p))
	return NewHandler(appapitoken.NewService(repo, appshared.NoopEventBus{})), repo, p, raw
}

func patchToken(h *Handler, id, userID, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/api-tokens/"+id, strings.NewReader(body))
	r.SetPathValue("id", id)
	r = r.WithContext(context.WithValue(r.Context(), middleware.UserIDKey, userID))
	w := httptest.NewRecorder()
	h.Update(w, r)
	return w
}

func TestHandlerUpdate_OmittedExpiryPreservesExpiredTokenPrecisely(t *testing.T) {
	h, repo, original, raw := setupUpdateHandler(t)
	w := patchToken(h, original.ID(), original.UserID(), `{"name":"  新名  "}`)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "新名", body.Data["name"])
	assert.NotContains(t, body.Data, "token")
	assert.NotContains(t, body.Data, "token_hash")
	assert.NotContains(t, w.Body.String(), raw)
	assert.NotContains(t, w.Body.String(), original.TokenHash())
	stored, err := repo.FindByID(context.Background(), original.ID(), original.UserID())
	require.NoError(t, err)
	assert.Equal(t, original.ExpiresAt(), stored.ExpiresAt())
	assert.Equal(t, original.CreatedAt(), stored.CreatedAt())
	assert.Equal(t, original.LastUsedAt(), stored.LastUsedAt())
	assert.Equal(t, original.TokenHash(), stored.TokenHash())
	assert.True(t, stored.IsExpired(time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)))
}

func TestHandlerUpdate_RejectsInvalidChangesWithoutWriting(t *testing.T) {
	for _, body := range []string{
		`{"name":""}`, `{"name":"  "}`, `{"name":"` + strings.Repeat("令", 101) + `"}`,
		`{"name":"新名","scopes":[]}`, `{"name":"新名","scopes":null}`,
		`{"name":"新名","scopes":["invalid:scope"]}`, `{"scopes":"posts:read"}`,
		`{"expires_at":""}`, `{"expires_at":"2020-01-01"}`, `{"expires_at":"tomorrow"}`,
		`{"interactive":"false"}`, `{"name":`, "",
	} {
		t.Run(body, func(t *testing.T) {
			h, repo, original, _ := setupUpdateHandler(t)
			w := patchToken(h, original.ID(), original.UserID(), body)
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			stored, err := repo.FindByID(context.Background(), original.ID(), original.UserID())
			require.NoError(t, err)
			assert.Equal(t, original.Name(), stored.Name())
			assert.Equal(t, original.Scopes(), stored.Scopes())
			assert.Equal(t, original.ExpiresAt(), stored.ExpiresAt())
			assert.Equal(t, original.Interactive(), stored.Interactive())
			assert.Equal(t, original.TokenHash(), stored.TokenHash())
		})
	}
}

func TestHandlerUpdate_RejectsForeignAndMissingTokens(t *testing.T) {
	h, repo, original, _ := setupUpdateHandler(t)
	for _, pair := range []struct{ id, userID string }{
		{original.ID(), "other"}, {"00000000-0000-0000-0000-000000000002", original.UserID()}, {"not-a-uuid", original.UserID()},
	} {
		w := patchToken(h, pair.id, pair.userID, `{"name":"不应保存"}`)
		assert.Equal(t, http.StatusNotFound, w.Code, w.Body.String())
	}
	stored, err := repo.FindByID(context.Background(), original.ID(), original.UserID())
	require.NoError(t, err)
	assert.Equal(t, original.Name(), stored.Name())
}

type usageLookup struct {
	domainapitoken.TokenLookup
	touched chan error
}

func (l usageLookup) TouchLastUsed(ctx context.Context, id string, now time.Time) error {
	err := l.TokenLookup.TouchLastUsed(ctx, id, now)
	l.touched <- err
	return err
}

func TestHandlerUpdate_OriginalPlaintextUsesLatestMCPAuthorization(t *testing.T) {
	h, repo, original, raw := setupUpdateHandler(t)
	lookup := usageLookup{TokenLookup: repo, touched: make(chan error, 1)}
	verifier := inframcp.NewPATVerifier(lookup)
	_, err := verifier.Verify(context.Background(), raw, nil)
	assert.ErrorIs(t, err, auth.ErrInvalidToken, "旧令牌原本已过期")

	w := patchToken(h, original.ID(), original.UserID(), `{"name":"新名","scopes":["notes:write"],"expires_at":"never","interactive":false}`)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	info, err := verifier.Verify(context.Background(), raw, nil)
	require.NoError(t, err)
	assert.Equal(t, []string{domainapitoken.ScopeNotesWrite}, info.Scopes)
	assert.False(t, inframcp.Interactive(info))
	assert.Equal(t, original.UserID(), info.UserID)
	select {
	case err := <-lookup.touched:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("等待异步使用记录超时")
	}

	w = patchToken(h, original.ID(), original.UserID(), `{"expires_at":"2099-10-20","interactive":true}`)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())
	info, err = verifier.Verify(context.Background(), raw, nil)
	require.NoError(t, err)
	assert.Equal(t, time.Date(2099, 10, 20, 23, 59, 59, 0, time.UTC), info.Expiration)
	assert.True(t, inframcp.Interactive(info))
	assert.Equal(t, []string{domainapitoken.ScopeNotesWrite}, info.Scopes, "省略权限字段保持当前权限")
	select {
	case err := <-lookup.touched:
		require.NoError(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("等待异步使用记录超时")
	}
	stored, err := repo.FindByHash(context.Background(), domainapitoken.HashToken(raw))
	require.NoError(t, err)
	assert.Equal(t, original.ID(), stored.ID())
	assert.Equal(t, original.CreatedAt(), stored.CreatedAt())
	assert.Equal(t, original.TokenHash(), stored.TokenHash())
}

func TestHandlerUsageScope_CreateUpdateList(t *testing.T) {
	h, _, original, _ := setupUpdateHandler(t)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/admin/api-tokens", strings.NewReader(`{"name":"usage client","scopes":["usage:write"],"expires_at":"never"}`))
	request = request.WithContext(context.WithValue(request.Context(), middleware.UserIDKey, original.UserID()))
	created := httptest.NewRecorder()
	h.Create(created, request)
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var result struct {
		Data struct {
			ID     string   `json:"id"`
			Scopes []string `json:"scopes"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &result))
	require.Equal(t, []string{"usage:write"}, result.Data.Scopes)

	updated := patchToken(h, original.ID(), original.UserID(), `{"scopes":["usage:write"]}`)
	require.Equal(t, http.StatusOK, updated.Code, updated.Body.String())
	invalid := patchToken(h, original.ID(), original.UserID(), `{"scopes":["usage:admin"]}`)
	require.Equal(t, http.StatusBadRequest, invalid.Code, invalid.Body.String())

	badRequest := httptest.NewRequest(http.MethodPost, "/api/v1/admin/api-tokens", strings.NewReader(`{"name":"invalid","scopes":["usage:admin"]}`))
	badRequest = badRequest.WithContext(context.WithValue(badRequest.Context(), middleware.UserIDKey, original.UserID()))
	rejected := httptest.NewRecorder()
	h.Create(rejected, badRequest)
	require.Equal(t, http.StatusBadRequest, rejected.Code, rejected.Body.String())

	listRequest := httptest.NewRequest(http.MethodGet, "/api/v1/admin/api-tokens", nil)
	listRequest = listRequest.WithContext(context.WithValue(listRequest.Context(), middleware.UserIDKey, original.UserID()))
	listed := httptest.NewRecorder()
	h.List(listed, listRequest)
	require.Equal(t, http.StatusOK, listed.Code, listed.Body.String())
	var list struct {
		Data []struct {
			Scopes []string `json:"scopes"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(listed.Body.Bytes(), &list))
	require.Len(t, list.Data, 2)
	for _, token := range list.Data {
		require.Equal(t, []string{"usage:write"}, token.Scopes)
	}
}
