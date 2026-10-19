package gorm

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
)

func relationDetailItem(t *testing.T, detail approadmap.DetailDTO, id string) approadmap.ItemDTO {
	t.Helper()
	for _, item := range detail.Items {
		if item.ID == id {
			return item
		}
	}
	t.Fatalf("公开详情缺少条目 %s", id)
	return approadmap.ItemDTO{}
}

func TestRoadmapRelationPublicDetailAndWriteResponsesStayCurrent(t *testing.T) {
	db := setupIntegrationDB(t)
	projectID := seedRelationProject(t, db)
	checker, bus := relationIntegrationChecker{}, appshared.NoopEventBus{}
	relations := approadmap.NewRelationService(NewRoadmapRelationRepository(db), checker, bus)
	service := approadmap.NewService(NewRoadmapRepository(db), NewProjectRepository(db), checker, bus, approadmap.WithRelations(relations))
	ctx := relationIntegrationContext()
	a, err := service.Create(ctx, projectID.String(), approadmap.CreateInput{Title: "Prerequisite"})
	require.NoError(t, err)
	b, err := service.Create(ctx, projectID.String(), approadmap.CreateInput{Title: "Target"})
	require.NoError(t, err)
	assert.False(t, a.Blocked)
	assert.False(t, b.Blocked)
	edge, err := relations.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: a.ID, TargetID: b.ID, Type: "blocks"})
	require.NoError(t, err)
	slug := "relation-" + projectID.String()
	checkDetail := func(blocked bool, relationCount int) approadmap.DetailDTO {
		t.Helper()
		detail, err := service.GetBySlug(context.Background(), slug)
		require.NoError(t, err)
		assert.Equal(t, blocked, relationDetailItem(t, detail, b.ID).Blocked)
		assert.Len(t, detail.Relations, relationCount)
		return detail
	}
	detail := checkDetail(true, 1)
	assert.Equal(t, edge.ID, detail.Relations[0].ID)
	for range 2 {
		updated, err := service.Update(ctx, projectID.String(), b.ID, approadmap.UpdateInput{Title: "Edited target"})
		require.NoError(t, err)
		assert.True(t, updated.Blocked, "编辑与无变化编辑都保留当前阻塞状态")
		moved, err := service.Move(ctx, projectID.String(), b.ID, approadmap.MoveInput{Stage: "in_progress"})
		require.NoError(t, err)
		assert.True(t, moved.Blocked, "移动与无变化移动都保留当前阻塞状态")
	}
	require.NoError(t, service.Delete(ctx, projectID.String(), b.ID))
	detail, err = service.GetBySlug(context.Background(), slug)
	require.NoError(t, err)
	assert.Len(t, detail.Items, 1)
	assert.Empty(t, detail.Relations)
	for range 2 {
		restored, err := service.Restore(ctx, projectID.String(), b.ID)
		require.NoError(t, err)
		assert.True(t, restored.Blocked, "恢复后的同一事务须读到重新可见的关系；重复恢复也须校准")
	}
	detail = checkDetail(true, 1)
	assert.Equal(t, edge.ID, detail.Relations[0].ID)
	require.NoError(t, service.Delete(ctx, projectID.String(), a.ID))
	checkDetail(false, 0)
	updated, err := service.Update(ctx, projectID.String(), b.ID, approadmap.UpdateInput{Title: "Edited target"})
	require.NoError(t, err)
	assert.False(t, updated.Blocked)
	_, err = service.Restore(ctx, projectID.String(), a.ID)
	require.NoError(t, err)
	checkDetail(true, 1)
	_, err = service.Move(ctx, projectID.String(), a.ID, approadmap.MoveInput{Stage: "completed"})
	require.NoError(t, err)
	checkDetail(false, 1)
	updated, err = service.Update(ctx, projectID.String(), b.ID, approadmap.UpdateInput{Title: "Edited target"})
	require.NoError(t, err)
	assert.False(t, updated.Blocked)
	_, err = service.Move(ctx, projectID.String(), a.ID, approadmap.MoveInput{Stage: "planned"})
	require.NoError(t, err)
	checkDetail(true, 1)
	require.NoError(t, relations.Delete(ctx, projectID.String(), edge.ID))
	_, err = relations.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: a.ID, TargetID: b.ID, Type: "extends"})
	require.NoError(t, err)
	checkDetail(false, 1)
	require.NoError(t, service.Delete(ctx, projectID.String(), b.ID))
	restored, err := service.Restore(ctx, projectID.String(), b.ID)
	require.NoError(t, err)
	assert.False(t, restored.Blocked, "显式删除的阻塞关系不会随条目恢复，extends 不参与 blocked")
	checkDetail(false, 1)
}
