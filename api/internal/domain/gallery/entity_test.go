package gallery

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

func TestNewGalleryCreatesEmptyWorkingDraft(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	assert.Equal(t, int64(1), gallery.Version())
	assert.Equal(t, StatusDraft, gallery.Status())
	assert.Empty(t, gallery.WorkingRevision().Title())
	assert.Empty(t, gallery.WorkingRevision().Summary())
	assert.Empty(t, gallery.WorkingRevision().Items())
}

func TestReplaceWorkingDocumentRejectsDuplicateWithoutAdvancingVersion(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	fileID := shared.NewID()
	err = gallery.ReplaceWorkingDocument(1, "标题", "摘要", []DocumentItem{{FileID: fileID}, {FileID: fileID}})
	require.Error(t, err)
	assert.Equal(t, int64(1), gallery.Version())
	assert.Empty(t, gallery.WorkingRevision().Items())
}

func TestReplaceWorkingDocumentNormalizesOrderAndAllowsEmptyFields(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	first, second := shared.NewID(), shared.NewID()
	err = gallery.ReplaceWorkingDocument(1, "  ", "  ", []DocumentItem{
		{FileID: first, Caption: " 第一张 "},
		{FileID: second, AltTextOverride: " 第二张替代文本 "},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), gallery.Version())
	assert.Equal(t, 0, gallery.WorkingRevision().Items()[0].Position())
	assert.Equal(t, 1, gallery.WorkingRevision().Items()[1].Position())
	assert.Equal(t, "第一张", gallery.WorkingRevision().Items()[0].Caption())
	assert.Empty(t, gallery.WorkingRevision().Title())
}

func TestReplaceWorkingDocumentRejectsMoreThanFiftyItems(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	items := make([]DocumentItem, MaxItems+1)
	for i := range items {
		items[i] = DocumentItem{FileID: shared.NewID(), Caption: fmt.Sprintf("图片 %d", i)}
	}
	require.Error(t, gallery.ReplaceWorkingDocument(1, "", "", items))
	assert.Equal(t, int64(1), gallery.Version())
}

func TestEnsureVersionReturnsConflict(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	err = gallery.EnsureVersion(2)
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeConflict))
}

func TestPublishRequiresCompleteWorkingRevisionAndAdvancesVersion(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)

	err = gallery.Publish(1, "gallery-slug", time.Now())
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	assert.Equal(t, int64(1), gallery.Version())

	first, second := shared.NewID(), shared.NewID()
	require.NoError(t, gallery.ReplaceWorkingDocument(1, "  作品标题  ", "摘要", []DocumentItem{{FileID: first}, {FileID: second}}))
	publishedAt := time.Date(2026, time.August, 31, 8, 0, 0, 0, time.UTC)
	require.NoError(t, gallery.Publish(2, "gallery-slug", publishedAt))

	assert.Equal(t, StatusPublished, gallery.Status())
	assert.Equal(t, "gallery-slug", gallery.Slug())
	require.NotNil(t, gallery.PublishedRevisionID())
	assert.True(t, gallery.PublishedRevisionID().Equal(gallery.WorkingRevision().ID()))
	require.NotNil(t, gallery.PublishedAt())
	assert.Equal(t, publishedAt, *gallery.PublishedAt())
	assert.Equal(t, int64(3), gallery.Version())
}

func TestPublishRejectsSingleImageAndSecondPublish(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	require.NoError(t, gallery.ReplaceWorkingDocument(1, "作品", "", []DocumentItem{{FileID: shared.NewID()}}))

	err = gallery.Publish(2, "gallery-slug", time.Now())
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))

	require.NoError(t, gallery.ReplaceWorkingDocument(2, "作品", "", []DocumentItem{{FileID: shared.NewID()}, {FileID: shared.NewID()}}))
	require.NoError(t, gallery.Publish(3, "gallery-slug", time.Now()))
	err = gallery.Publish(4, "another-slug", time.Now())
	require.Error(t, err)
	assert.True(t, shared.IsDomainError(err, shared.CodeConflict))
}

func TestCloneWorkingRevisionPreservesPublishedSnapshot(t *testing.T) {
	gallery, err := NewGallery(shared.NewID(), shared.NewID(), shared.NewID())
	require.NoError(t, err)
	first, second := shared.NewID(), shared.NewID()
	require.NoError(t, gallery.ReplaceWorkingDocument(1, "公开标题", "公开摘要", []DocumentItem{{FileID: first, Caption: "公开说明"}, {FileID: second}}))
	require.NoError(t, gallery.Publish(2, "gallery-slug", time.Now()))
	publishedID := *gallery.PublishedRevisionID()

	newRevisionID := shared.NewID()
	require.NoError(t, gallery.CloneWorkingRevision(newRevisionID))
	assert.True(t, gallery.WorkingRevision().ID().Equal(newRevisionID))
	assert.True(t, gallery.PublishedRevisionID().Equal(publishedID))
	assert.Equal(t, "公开标题", gallery.WorkingRevision().Title())
	assert.Equal(t, "公开说明", gallery.WorkingRevision().Items()[0].Caption())
	assert.Equal(t, int64(3), gallery.Version())
}
