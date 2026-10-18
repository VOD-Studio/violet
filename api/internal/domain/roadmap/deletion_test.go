package roadmap

import (
	"testing"
	"time"

	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestItemSoftDeleteAndRestoreKeepOriginalState(t *testing.T) {
	createdAt := time.Date(2026, 10, 18, 0, 0, 0, 0, time.UTC)
	item, err := NewItem(shared.NewID(), shared.NewID(), 17, Content{Title: "Delivered", Description: "Original",
		Tags: []string{"API"}, Links: []Link{{Label: "Issue", URL: "/posts/issue"}}, DeliveredVersion: "v2"}, Completed, "V1", createdAt)
	require.NoError(t, err)
	item.PullEvents()
	itemID, projectID := item.ID(), item.ProjectID()
	deletedAt := createdAt.Add(time.Hour)
	item.SoftDelete(deletedAt)
	assert.Equal(t, &deletedAt, item.DeletedAt())
	assert.Equal(t, deletedAt, item.UpdatedAt())
	events := item.PullEvents()
	require.Len(t, events, 1)
	assert.Equal(t, "roadmap.item.deleted", events[0].EventName())
	assert.Equal(t, itemID, events[0].AggregateID())
	item.SoftDelete(deletedAt.Add(time.Hour))
	assert.Equal(t, &deletedAt, item.DeletedAt())
	assert.Empty(t, item.PullEvents())

	restoredAt := deletedAt.Add(2 * time.Hour)
	item.Restore(restoredAt)
	assert.Nil(t, item.DeletedAt())
	assert.Equal(t, restoredAt, item.UpdatedAt())
	assert.Equal(t, itemID, item.ID())
	assert.Equal(t, projectID, item.ProjectID())
	assert.Equal(t, int64(17), item.Number())
	assert.Equal(t, "V1", item.Position())
	assert.Equal(t, Completed, item.Stage())
	assert.Equal(t, "Delivered", item.Title())
	assert.Equal(t, "Original", item.Description())
	assert.Equal(t, []string{"API"}, item.Tags())
	assert.Equal(t, []Link{{Label: "Issue", URL: "/posts/issue"}}, item.Links())
	assert.Equal(t, "2026-10-18", item.CompletionDate().Format(time.DateOnly))
	assert.Equal(t, "v2", item.DeliveredVersion())
	assert.Equal(t, createdAt, item.CreatedAt())
	events = item.PullEvents()
	require.Len(t, events, 1)
	assert.Equal(t, "roadmap.item.restored", events[0].EventName())
	item.Restore(restoredAt.Add(time.Hour))
	assert.Equal(t, restoredAt, item.UpdatedAt())
	assert.Empty(t, item.PullEvents())
}

func TestDeletedItemRejectsContentAndMoveChanges(t *testing.T) {
	now := time.Now()
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Original"}, Planned, "V", now)
	require.NoError(t, err)
	item.SoftDelete(now)
	assert.ErrorIs(t, item.UpdateContent(Content{Title: "Changed"}, now), ErrNotFound)
	assert.ErrorIs(t, item.Move(Completed, "a", nil, "v2", now), ErrNotFound)
	assert.Equal(t, "Original", item.Title())
	assert.Equal(t, Planned, item.Stage())
}
