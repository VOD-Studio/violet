package siteidentity

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	appsiteidentity "blog-api/internal/application/siteidentity"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubSettingsReader struct {
	values map[string]string
	err    error
}

func (s stubSettingsReader) GetAll(context.Context) (map[string]string, error) {
	return s.values, s.err
}

func TestGetReturnsEnvelopeCacheHeadersAndConditional304(t *testing.T) {
	handler := NewHandler(appsiteidentity.NewService(stubSettingsReader{values: map[string]string{
		"site_name":       "Violet",
		"github_username": "octocat",
		"github_token":    "must-not-leak",
		"llm_api_key":     "must-not-leak-either",
	}}))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/site-identity", nil)
	response := httptest.NewRecorder()
	handler.Get(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "application/json; charset=utf-8", response.Header().Get("Content-Type"))
	assert.Equal(t, "public, max-age=60, stale-while-revalidate=300", response.Header().Get("Cache-Control"))
	etag := response.Header().Get("ETag")
	assert.True(t, strings.HasPrefix(etag, `W/"`))
	assert.NotContains(t, response.Body.String(), "github_token")
	assert.NotContains(t, response.Body.String(), "llm_api_key")
	assert.NotContains(t, response.Body.String(), "must-not-leak")
	assert.Contains(t, response.Body.String(), `"banner_url":null`)
	assert.Contains(t, response.Body.String(), `"social_links":[`)
	assert.Contains(t, response.Body.String(), `"subscription_channels":[`)
	assert.NotContains(t, response.Body.String(), "bannerURL")
	assert.NotContains(t, response.Body.String(), "subscriptionChannels")

	var body struct {
		Data appsiteidentity.IdentityDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	assert.Equal(t, "Violet", body.Data.SiteName)
	assert.NotNil(t, body.Data.SocialLinks)
	assert.NotNil(t, body.Data.SubscriptionChannels)
	require.Len(t, body.Data.SubscriptionChannels, 1)
	assert.Equal(t, "rss", body.Data.SubscriptionChannels[0].Kind)

	conditionalRequest := httptest.NewRequest(http.MethodGet, "/api/v1/site-identity", nil)
	conditionalRequest.Header.Set("If-None-Match", `"unrelated", `+etag)
	conditionalResponse := httptest.NewRecorder()
	handler.Get(conditionalResponse, conditionalRequest)
	assert.Equal(t, http.StatusNotModified, conditionalResponse.Code)
	assert.Empty(t, conditionalResponse.Body.String())
	assert.Equal(t, etag, conditionalResponse.Header().Get("ETag"))
	assert.Equal(t, "public, max-age=60, stale-while-revalidate=300", conditionalResponse.Header().Get("Cache-Control"))
}

func TestGetReturnsUnifiedError(t *testing.T) {
	handler := NewHandler(appsiteidentity.NewService(stubSettingsReader{err: errors.New("database unavailable")}))
	response := httptest.NewRecorder()
	handler.Get(response, httptest.NewRequest(http.MethodGet, "/api/v1/site-identity", nil))

	assert.Equal(t, http.StatusInternalServerError, response.Code)
	assert.Contains(t, response.Body.String(), `"error":"INTERNAL_ERROR"`)
}
