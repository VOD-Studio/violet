package publication

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	apppublication "blog-api/internal/application/publication"
	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRepository struct {
	rows []domainpublication.Entry
}

func (r *fakeRepository) FindPage(context.Context, domainpublication.Query) ([]domainpublication.Entry, error) {
	return r.rows, nil
}

func TestListReturnsCursorEnvelopeAndConditionalCache(t *testing.T) {
	repo := &fakeRepository{rows: []domainpublication.Entry{{
		Kind: domainpublication.KindArticle, SourceID: shared.NewID(), RouteKey: "entry", Title: "Entry",
		PublishedAt: time.Date(2026, time.September, 7, 8, 0, 0, 0, time.UTC), Featured: true,
	}}}
	handler := NewHandler(apppublication.NewService(repo, []byte("cursor-secret")))

	request := httptest.NewRequest(http.MethodGet, "/api/v1/publications?limit=1", nil)
	response := httptest.NewRecorder()
	handler.List(response, request)

	require.Equal(t, http.StatusOK, response.Code)
	assert.Equal(t, "public, max-age=30, stale-while-revalidate=120", response.Header().Get("Cache-Control"))
	etag := response.Header().Get("ETag")
	assert.NotEmpty(t, etag)
	var body struct {
		Data []apppublication.ItemDTO `json:"data"`
		Meta struct {
			Pagination struct {
				Limit int `json:"limit"`
			} `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	assert.Equal(t, 1, body.Meta.Pagination.Limit)

	conditional := httptest.NewRequest(http.MethodGet, "/api/v1/publications?limit=1", nil)
	conditional.Header.Set("If-None-Match", etag)
	notModified := httptest.NewRecorder()
	handler.List(notModified, conditional)
	assert.Equal(t, http.StatusNotModified, notModified.Code)
	assert.Empty(t, notModified.Body.String())
}

func TestListRejectsInvalidCursorAndDates(t *testing.T) {
	handler := NewHandler(apppublication.NewService(&fakeRepository{}, []byte("cursor-secret")))
	for _, target := range []string{
		"/api/v1/publications?cursor=tampered",
		"/api/v1/publications?from=yesterday",
		"/api/v1/publications?featured=sometimes",
	} {
		response := httptest.NewRecorder()
		handler.List(response, httptest.NewRequest(http.MethodGet, target, nil))
		assert.Equal(t, http.StatusBadRequest, response.Code, target)
	}
}
