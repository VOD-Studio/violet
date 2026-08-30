package media

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

func TestListByOwnerKeepsOwnerAndCatalogFilters(t *testing.T) {
	ownerID := domainshared.NewID()
	repo := &fakeFileRepo{}
	service := NewUploadService(repo, nil, nil, nil, "", "", "")

	_, err := service.ListByOwner(context.Background(), ownerID.String(), ListFilesInput{
		Purpose: "material", MimeCategory: "image", Category: "作品", Keyword: "封面",
	}, domainshared.PageQuery{Page: 2, Limit: 20})
	require.NoError(t, err)
	require.NotNil(t, repo.lastFilter.OwnerID)
	assert.True(t, repo.lastFilter.OwnerID.Equal(ownerID))
	assert.Equal(t, "material", repo.lastFilter.Purpose)
	assert.Equal(t, "image/", repo.lastFilter.MimePrefix)
	assert.Equal(t, "作品", repo.lastFilter.Category)
	assert.Equal(t, "封面", repo.lastFilter.Keyword)
}

func TestListFilesMapsFileCategoryToNonMediaFilter(t *testing.T) {
	repo := &fakeFileRepo{}
	service := NewUploadService(repo, nil, nil, nil, "", "", "")

	_, err := service.ListAllFiles(context.Background(), ListFilesInput{MimeCategory: "file"}, domainshared.PageQuery{})
	require.NoError(t, err)
	assert.Empty(t, repo.lastFilter.MimePrefix)
	assert.Equal(t, []string{"image/", "video/", "audio/"}, repo.lastFilter.ExcludeMimePrefixes)
}
