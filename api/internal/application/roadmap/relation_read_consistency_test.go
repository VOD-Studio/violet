package roadmap

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

type detailItemReadHook struct {
	domain.Repository
	afterRead func()
}

func (r detailItemReadHook) FindByProject(ctx context.Context, projectID shared.ID) ([]*domain.Item, error) {
	items, err := r.Repository.FindByProject(ctx, projectID)
	if err == nil {
		r.afterRead()
	}
	return items, err
}

func TestPublicDetailFiltersRelationsAddedAfterItemRead(t *testing.T) {
	base, repo, bus, ctx := testService(t)
	items := make([]ItemDTO, 0, 3)
	for _, title := range []string{"A", "B", "C"} {
		item, err := base.Create(ctx, repo.project.String(), CreateInput{Title: title})
		require.NoError(t, err)
		items = append(items, item)
	}
	relationRepo := &memoryRelationRepository{items: repo, relations: make(map[shared.ID]*domain.Relation)}
	relations := NewRelationService(relationRepo, base.checker, bus)
	validBlocks, err := relations.Create(ctx, repo.project.String(), CreateRelationInput{
		SourceID: items[0].ID, TargetID: items[1].ID, Type: "blocks",
	})
	require.NoError(t, err)
	validExtends, err := relations.Create(ctx, repo.project.String(), CreateRelationInput{
		SourceID: items[0].ID, TargetID: items[2].ID, Type: "extends",
	})
	require.NoError(t, err)
	hook := detailItemReadHook{Repository: base.repo, afterRead: func() {
		added, err := base.Create(ctx, repo.project.String(), CreateInput{Title: "Added between reads"})
		require.NoError(t, err)
		for _, edge := range []CreateRelationInput{
			{SourceID: items[0].ID, TargetID: added.ID, Type: "blocks"},
			{SourceID: added.ID, TargetID: items[2].ID, Type: "blocks"},
		} {
			_, err := relations.Create(ctx, repo.project.String(), edge)
			require.NoError(t, err)
		}
	}}
	service := NewService(hook, base.projects, base.checker, bus, WithRelations(relations))
	slug := base.projects.(projectRepository).project.Slug()
	detail, err := service.GetBySlug(context.Background(), slug)
	require.NoError(t, err)
	assert.Len(t, detail.Items, 3)
	assert.ElementsMatch(t, []RelationDTO{validBlocks, validExtends}, detail.Relations)
	byID := make(map[string]ItemDTO, len(detail.Items))
	for _, item := range detail.Items {
		byID[item.ID] = item
	}
	assert.False(t, byID[items[0].ID].Blocked)
	assert.True(t, byID[items[1].ID].Blocked, "本次条目集合内的有效阻塞关系仍须生效")
	assert.False(t, byID[items[2].ID].Blocked, "本次未读取到的前置条目不能影响 blocked")
	for _, relation := range detail.Relations {
		assert.Contains(t, byID, relation.SourceID)
		assert.Contains(t, byID, relation.TargetID)
	}
}
