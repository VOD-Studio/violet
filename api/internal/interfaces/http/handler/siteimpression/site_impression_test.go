package siteimpression

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	appsiteimpression "blog-api/internal/application/siteimpression"
	domainsiteimpression "blog-api/internal/domain/siteimpression"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type handlerMemoryRepository struct {
	hashes map[domainsiteimpression.TokenHash]struct{}
}

func newHandlerMemoryRepository() *handlerMemoryRepository {
	return &handlerMemoryRepository{hashes: make(map[domainsiteimpression.TokenHash]struct{})}
}

func (r *handlerMemoryRepository) Ensure(_ context.Context, hash domainsiteimpression.TokenHash) error {
	r.hashes[hash] = struct{}{}
	return nil
}

func (r *handlerMemoryRepository) Count(context.Context) (int64, error) {
	return int64(len(r.hashes)), nil
}

func (r *handlerMemoryRepository) Contains(_ context.Context, hash domainsiteimpression.TokenHash) (bool, error) {
	_, exists := r.hashes[hash]
	return exists, nil
}

func TestHandlerLifecycleUsesPrivateStatusAndSecureCookie(t *testing.T) {
	handler := NewHandler(
		appsiteimpression.NewService(newHandlerMemoryRepository(), []byte("site-impression-token-key")),
		"example.com",
	)

	initialResponse := httptest.NewRecorder()
	handler.Get(initialResponse, httptest.NewRequest(http.MethodGet, "/api/v1/site-impressions", nil))
	require.Equal(t, http.StatusOK, initialResponse.Code)
	assert.Equal(t, privateCacheControl, initialResponse.Header().Get("Cache-Control"))
	assert.Equal(t, "Cookie", initialResponse.Header().Get("Vary"))
	assert.Contains(t, initialResponse.Body.String(), `"count":0`)
	assert.Contains(t, initialResponse.Body.String(), `"impressed":false`)

	postResponse := httptest.NewRecorder()
	handler.Post(postResponse, httptest.NewRequest(http.MethodPost, "/api/v1/site-impressions", nil))
	require.Equal(t, http.StatusOK, postResponse.Code)
	assert.Contains(t, postResponse.Body.String(), `"count":1`)
	assert.Contains(t, postResponse.Body.String(), `"impressed":true`)
	cookies := postResponse.Result().Cookies()
	require.Len(t, cookies, 1)
	cookie := cookies[0]
	assert.Equal(t, impressionCookieName, cookie.Name)
	assert.Equal(t, "/", cookie.Path)
	assert.Equal(t, "example.com", cookie.Domain)
	assert.Equal(t, impressionCookieMaxAge, cookie.MaxAge)
	assert.True(t, cookie.HttpOnly)
	assert.True(t, cookie.Secure)
	assert.Equal(t, http.SameSiteLaxMode, cookie.SameSite)
	decoded, err := base64.RawURLEncoding.Strict().DecodeString(cookie.Value)
	require.NoError(t, err)
	assert.Len(t, decoded, 16)

	repeatRequest := httptest.NewRequest(http.MethodPost, "/api/v1/site-impressions", nil)
	repeatRequest.AddCookie(cookie)
	repeatResponse := httptest.NewRecorder()
	handler.Post(repeatResponse, repeatRequest)
	require.Equal(t, http.StatusOK, repeatResponse.Code)
	assert.Empty(t, repeatResponse.Header().Values("Set-Cookie"))
	assert.Contains(t, repeatResponse.Body.String(), `"count":1`)
	assert.Contains(t, repeatResponse.Body.String(), `"impressed":true`)

	knownRequest := httptest.NewRequest(http.MethodGet, "/api/v1/site-impressions", nil)
	knownRequest.AddCookie(cookie)
	knownResponse := httptest.NewRecorder()
	handler.Get(knownResponse, knownRequest)
	require.Equal(t, http.StatusOK, knownResponse.Code)
	assert.Contains(t, knownResponse.Body.String(), `"count":1`)
	assert.Contains(t, knownResponse.Body.String(), `"impressed":true`)
}
