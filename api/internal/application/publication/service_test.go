package publication

import (
	"context"
	"testing"
	"time"

	domainpublication "blog-api/internal/domain/publication"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeRepository struct {
	rows      []domainpublication.Entry
	lastQuery domainpublication.Query
}

func (r *fakeRepository) FindPage(_ context.Context, query domainpublication.Query) ([]domainpublication.Entry, error) {
	r.lastQuery = query
	return r.rows, nil
}

func TestListReturnsStableSignedCursor(t *testing.T) {
	publishedAt := time.Date(2026, time.September, 7, 8, 0, 0, 123, time.UTC)
	rows := []domainpublication.Entry{
		{Kind: domainpublication.KindArticle, SourceID: shared.NewID(), RouteKey: "first", Title: "First", PublishedAt: publishedAt, Featured: true},
		{Kind: domainpublication.KindNote, SourceID: shared.NewID(), RouteKey: "second", Title: "Second", PublishedAt: publishedAt},
		{Kind: domainpublication.KindGallery, SourceID: shared.NewID(), RouteKey: "third", Title: "Third", PublishedAt: publishedAt.Add(-time.Hour)},
	}
	repo := &fakeRepository{rows: rows}
	service := NewService(repo, []byte("cursor-secret"))

	page, err := service.List(context.Background(), ListQuery{Limit: 2})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	assert.True(t, page.HasMore)
	assert.NotEmpty(t, page.NextCursor)
	assert.Equal(t, 3, repo.lastQuery.Limit)
	assert.Equal(t, "article:"+rows[0].SourceID.String(), page.Items[0].ID)

	_, err = service.List(context.Background(), ListQuery{Cursor: page.NextCursor + "tampered", Limit: 2})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))

	repo.rows = nil
	_, err = service.List(context.Background(), ListQuery{Cursor: page.NextCursor, Limit: 2})
	require.NoError(t, err)
	require.NotNil(t, repo.lastQuery.Cursor)
	assert.Equal(t, rows[1].Kind, repo.lastQuery.Cursor.Kind)
	assert.True(t, rows[1].SourceID.Equal(repo.lastQuery.Cursor.SourceID))
	assert.Equal(t, rows[1].PublishedAt, repo.lastQuery.Cursor.PublishedAt)
}

func TestListValidatesTimeBoundsAndFeaturedFilter(t *testing.T) {
	repo := &fakeRepository{}
	service := NewService(repo, []byte("cursor-secret"))

	_, err := service.List(context.Background(), ListQuery{From: "not-a-date"})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))

	_, err = service.List(context.Background(), ListQuery{
		From: "2026-09-08T00:00:00Z",
		To:   "2026-09-07T00:00:00Z",
	})
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))

	_, err = service.List(context.Background(), ListQuery{Featured: "true"})
	require.NoError(t, err)
	assert.True(t, repo.lastQuery.FeaturedOnly)

	for _, featured := range []string{"yes", "1", "TRUE"} {
		_, err = service.List(context.Background(), ListQuery{Featured: featured})
		require.Error(t, err)
		assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	}
}
