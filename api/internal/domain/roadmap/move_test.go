package roadmap

import (
	"testing"
	"time"

	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestItemMoveMaintainsCompletionMetadata(t *testing.T) {
	now := time.Date(2026, 10, 19, 0, 30, 0, 0, time.FixedZone("Asia/Shanghai", 8*3600))
	item, err := NewItem(shared.NewID(), shared.NewID(), 12, Content{Title: "Item"}, Planned, "V", now)
	require.NoError(t, err)
	item.PullEvents()
	require.NoError(t, item.Move(Completed, "W", nil, "v2", now))
	assert.Equal(t, "2026-10-19", item.CompletionDate().Format(time.DateOnly))
	assert.Equal(t, "v2", item.DeliveredVersion())
	events := item.PullEvents()
	require.Len(t, events, 1)
	change := events[0].(ItemStageChanged)
	assert.Equal(t, Planned, change.From)
	assert.Equal(t, Completed, change.To)
	assert.Equal(t, item.ID(), change.AggregateID())

	require.NoError(t, item.Move(InProgress, "a", item.CompletionDate(), item.DeliveredVersion(), now.Add(time.Hour)))
	assert.Nil(t, item.CompletionDate())
	assert.Empty(t, item.DeliveredVersion())
	item.PullEvents()
	explicit := time.Date(2026, 10, 7, 0, 0, 0, 0, time.UTC)
	require.NoError(t, item.Move(Completed, "b", &explicit, "v3", now.AddDate(0, 0, 2)))
	assert.Equal(t, "2026-10-07", item.CompletionDate().Format(time.DateOnly))
	assert.Equal(t, "v3", item.DeliveredVersion())
}

func TestItemMoveRejectsCompletedReorderAndOnlyAuditsStageChanges(t *testing.T) {
	now := time.Now()
	item, err := NewItem(shared.NewID(), shared.NewID(), 1, Content{Title: "Item"}, Planned, "V", now)
	require.NoError(t, err)
	item.PullEvents()
	require.NoError(t, item.Move(Planned, "W", nil, "", now.Add(time.Minute)))
	assert.Equal(t, "W", item.Position())
	assert.Empty(t, item.PullEvents())
	require.NoError(t, item.Move(Completed, "a", nil, "", now.Add(time.Hour)))
	item.PullEvents()
	date := item.CompletionDate()
	require.Error(t, item.Move(Completed, "b", nil, "v2", now.Add(2*time.Hour)))
	assert.Equal(t, "a", item.Position())
	assert.Equal(t, date, item.CompletionDate())
	assert.Empty(t, item.DeliveredVersion())
	assert.Empty(t, item.PullEvents())
}
