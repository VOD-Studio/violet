package gorm

import (
	"context"
	"testing"

	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoadmapRepositoryIntegrationSoftDeleteRestoresOriginalItem(t *testing.T) {
	db := setupIntegrationDB(t)
	pid := seedRoadmapProject(t, db)
	svc := approadmap.NewService(NewRoadmapRepository(db), NewProjectRepository(db), roadmapMoveAllowChecker{}, appshared.NoopEventBus{})
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, shared.NewID().String())
	date := "2026-10-01"
	item, err := svc.Create(ctx, pid.String(), approadmap.CreateInput{Title: "Original", Description: "Description",
		Stage: "completed", Tags: []string{"API", "Backend"}, Links: []approadmap.LinkDTO{{Label: "PR", URL: "/posts/pr"}},
		CompletionDate: &date, DeliveredVersion: "v3"})
	require.NoError(t, err)
	require.NoError(t, svc.Delete(ctx, pid.String(), item.ID))
	require.NoError(t, svc.Delete(ctx, pid.String(), item.ID))
	var total, active int64
	require.NoError(t, db.Table("roadmap_items").Where("project_id = ?", pid.UUID()).Count(&total).Error)
	require.NoError(t, db.Table("roadmap_items").Where("project_id = ? AND deleted_at IS NULL", pid.UUID()).Count(&active).Error)
	assert.Equal(t, int64(1), total, "软删除不移除物理行")
	assert.Zero(t, active)
	newItem, err := svc.Create(ctx, pid.String(), approadmap.CreateInput{Title: "Next"})
	require.NoError(t, err)
	assert.Equal(t, item.Number+1, newItem.Number)
	restored, err := svc.Restore(ctx, pid.String(), item.ID)
	require.NoError(t, err)
	expected := item
	expected.UpdatedAt = restored.UpdatedAt
	assert.Equal(t, expected, restored)
	repeated, err := svc.Restore(ctx, pid.String(), item.ID)
	require.NoError(t, err)
	assert.Equal(t, restored, repeated)
	require.NoError(t, db.Table("roadmap_items").Where("project_id = ?", pid.UUID()).Count(&total).Error)
	assert.Equal(t, int64(2), total, "恢复复用原行")
	stored, err := NewRoadmapRepository(db).FindByID(ctx, shared.MustParseID(item.ID), false)
	require.NoError(t, err)
	assert.Nil(t, stored.DeletedAt())
	assert.Equal(t, "2026-10-01", stored.CompletionDate().Format("2006-01-02"))
	assert.Equal(t, "v3", stored.DeliveredVersion())
}
