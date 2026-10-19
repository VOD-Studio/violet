package audit

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

func TestSubscriber_RoadmapItemContent(t *testing.T) {
	store := &fakeStore{}
	subscriber := newTestSubscriber(store)
	ctx := auditCtx(t, "actor", "admin@example.com", "127.0.0.1", "test")
	projectID, itemID := shared.NewID(), shared.NewID()
	item, err := roadmap.NewItem(itemID, projectID, 12, roadmap.Content{Title: "Original"}, roadmap.Planned, "V", time.Now())
	require.NoError(t, err)
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	require.NoError(t, item.UpdateContent(roadmap.Content{Title: "Edited", Description: "Description"}, time.Now()))
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	require.Len(t, store.appended, 2)
	assert.Equal(t, domainaudit.ActionCreate, store.appended[0].Action)
	assert.Equal(t, domainaudit.ActionUpdate, store.appended[1].Action)
	assert.Equal(t, "Original", store.appended[0].Resource.Name)
	assert.Equal(t, "Edited", store.appended[1].Resource.Name)
	assert.Contains(t, store.appended[1].Changes, domainaudit.FieldChange{Field: "title", From: "Original", To: "Edited"})
	for _, entry := range store.appended {
		assert.Equal(t, "roadmap_item", entry.Resource.Type)
		assert.Equal(t, itemID.String(), entry.Resource.ID)
		assert.Equal(t, projectID.String(), entry.Metadata["project_id"])
		assert.Equal(t, int64(12), entry.Metadata["number"])
		assert.Equal(t, "actor", entry.Actor.UserID)
		assert.Contains(t, entry.Summary, "#12")
	}
}

func TestSubscriber_RoadmapStageChangeExcludesReorder(t *testing.T) {
	store := &fakeStore{}
	subscriber := newTestSubscriber(store)
	ctx := auditCtx(t, "actor", "admin@example.com", "127.0.0.1", "test")
	item, err := roadmap.NewItem(shared.NewID(), shared.NewID(), 1, roadmap.Content{Title: "Flow"}, roadmap.Planned, "V", time.Now())
	require.NoError(t, err)
	item.PullEvents()
	require.NoError(t, item.Move(roadmap.Planned, "W", nil, "", time.Now()))
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	assert.Empty(t, store.appended)
	require.NoError(t, item.Move(roadmap.Completed, "W", nil, "v1", time.Now()))
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	require.Len(t, store.appended, 1)
	assert.Equal(t, domainaudit.ActionUpdate, store.appended[0].Action)
	assert.Equal(t, []domainaudit.FieldChange{{Field: "stage", From: "planned", To: "completed"}}, store.appended[0].Changes)
}

func TestSubscriber_RoadmapDeletionAndRestore(t *testing.T) {
	store := &fakeStore{}
	subscriber := newTestSubscriber(store)
	ctx := auditCtx(t, "actor", "admin@example.com", "127.0.0.1", "test")
	item, err := roadmap.NewItem(shared.NewID(), shared.NewID(), 1, roadmap.Content{Title: "Restore"}, roadmap.Planned, "V", time.Now())
	require.NoError(t, err)
	item.PullEvents()
	item.SoftDelete(time.Now())
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	item.Restore(time.Now())
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	require.Len(t, store.appended, 2)
	assert.Equal(t, domainaudit.ActionDelete, store.appended[0].Action)
	assert.Equal(t, domainaudit.ActionUpdate, store.appended[1].Action)
	assert.Contains(t, store.appended[1].Summary, "恢复")
	assert.Equal(t, []domainaudit.FieldChange{{Field: "deleted", From: true, To: false}}, store.appended[1].Changes)
}

func TestSubscriber_RoadmapRelationLifecycle(t *testing.T) {
	store := &fakeStore{}
	subscriber := newTestSubscriber(store)
	ctx := auditCtx(t, "actor", "admin@example.com", "127.0.0.1", "test")
	projectID, sourceID, targetID := shared.NewID(), shared.NewID(), shared.NewID()
	relation, err := roadmap.NewRelation(shared.NewID(), projectID, sourceID, targetID, roadmap.RelationBlocks, time.Now())
	require.NoError(t, err)
	for _, event := range relation.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	relation.MarkDeleted()
	for _, event := range relation.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	require.Len(t, store.appended, 2)
	assert.Equal(t, domainaudit.ActionCreate, store.appended[0].Action)
	assert.Equal(t, domainaudit.ActionDelete, store.appended[1].Action)
	for _, entry := range store.appended {
		assert.Equal(t, "roadmap_relation", entry.Resource.Type)
		assert.Equal(t, relation.ID().String(), entry.Resource.ID)
		assert.Equal(t, projectID.String(), entry.Metadata["project_id"])
		assert.Equal(t, sourceID.String(), entry.Metadata["source_id"])
		assert.Equal(t, targetID.String(), entry.Metadata["target_id"])
		assert.Equal(t, "blocks", entry.Metadata["type"])
	}
}
