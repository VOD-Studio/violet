package gallery

import (
	"fmt"
	"testing"

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
