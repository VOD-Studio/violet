package gorm

import (
	"context"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestGalleryPublishedSummaryAndPagesIgnoreWorkingAndWithdrawnRevisions(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "gallery-summary.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Gallery{}, &model.GalleryRevision{}, &model.GalleryRevisionItem{}))
	repo := NewGalleryRepository(db)
	ctx := context.Background()
	summary, err := repo.PublishedSummary(ctx)
	require.NoError(t, err)
	assert.Equal(t, domaingallery.PublishedSummary{}, summary)

	publishedAt := time.Date(2026, time.August, 31, 9, 0, 0, 0, time.UTC)
	commonFileID := shared.NewID()
	publishedIDs := make([]string, 0, 2)
	for index := range 4 {
		galleryID, workingID, publicID := shared.NewID(), shared.NewID(), shared.NewID()
		slug := "gallery-" + galleryID.String()
		working := model.GalleryRevision{
			ID: workingID.UUID(), GalleryID: galleryID.UUID(), Title: "维护中标题", Location: "私密工作稿地点",
			CreatedAt: publishedAt, UpdatedAt: publishedAt,
		}
		require.NoError(t, db.Create(&working).Error)
		for position := range 5 {
			require.NoError(t, db.Create(&model.GalleryRevisionItem{
				RevisionID: workingID.UUID(), FileID: shared.NewID().UUID(), Position: position,
			}).Error)
		}
		root := model.Gallery{
			ID: galleryID.UUID(), AuthorID: shared.NewID().UUID(), WorkingRevisionID: workingID.UUID(),
			Version: 4, CreatedAt: publishedAt, UpdatedAt: publishedAt,
		}
		if index < 2 {
			public := model.GalleryRevision{
				ID: publicID.UUID(), GalleryID: galleryID.UUID(), Title: "公开标题", Summary: "公开摘要", Location: "公开地点",
				CreatedAt: publishedAt, UpdatedAt: publishedAt,
			}
			require.NoError(t, db.Create(&public).Error)
			for position := range index + 2 {
				fileID := shared.NewID()
				if position == 0 {
					fileID = commonFileID
				}
				require.NoError(t, db.Create(&model.GalleryRevisionItem{
					RevisionID: publicID.UUID(), FileID: fileID.UUID(), Position: position,
					Caption: "公开说明", AltTextOverride: "公开替代文本",
				}).Error)
			}
			id := publicID.UUID()
			root.PublishedRevisionID, root.PublishedAt, root.Slug = &id, &publishedAt, &slug
			publishedIDs = append(publishedIDs, galleryID.String())
		} else if index == 3 {
			root.Slug, root.PublishedAt = &slug, &publishedAt
		}
		require.NoError(t, db.Create(&root).Error)
	}

	summary, err = repo.PublishedSummary(ctx)
	require.NoError(t, err)
	assert.Equal(t, domaingallery.PublishedSummary{AlbumCount: 2, ImageCount: 5}, summary)
	first, err := repo.FindPublishedPage(ctx, nil, 1)
	require.NoError(t, err)
	require.Len(t, first, 1)
	sort.Sort(sort.Reverse(sort.StringSlice(publishedIDs)))
	assert.Equal(t, publishedIDs[0], first[0].ID.String(), "同一首发时间以 ID 倒序确定精选")
	second, err := repo.FindPublishedPage(ctx, &domaingallery.PublishedCursor{PublishedAt: first[0].PublishedAt, ID: first[0].ID}, 1)
	require.NoError(t, err)
	require.Len(t, second, 1)
	assert.Equal(t, publishedIDs[1], second[0].ID.String())
	for _, page := range [][]domaingallery.PublishedGallery{first, second} {
		row := page[0]
		assert.Equal(t, "公开标题", row.Revision.Title())
		assert.Equal(t, "公开地点", row.Revision.Location())
		assert.Equal(t, "公开说明", row.Revision.Items()[0].Caption())
		detail, err := repo.FindPublishedBySlug(ctx, row.Slug)
		require.NoError(t, err)
		assert.Equal(t, row.Revision.Location(), detail.Revision.Location())
	}
	afterPaging, err := repo.PublishedSummary(ctx)
	require.NoError(t, err)
	assert.Equal(t, summary, afterPaging, "总数不依赖当前游标页")
}
