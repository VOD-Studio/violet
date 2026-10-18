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
