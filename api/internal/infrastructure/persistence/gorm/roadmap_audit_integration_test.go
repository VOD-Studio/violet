package gorm

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appaudit "blog-api/internal/application/audit"
	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

func TestRoadmapAuditIntegration_LongTitle(t *testing.T) {
	db := setupIntegrationDB(t)
	store := NewEventStore(db)
	subscriber := appaudit.NewSubscriber(store, zerolog.Nop())
	title := strings.Repeat("路线", 150)
	item, err := roadmap.NewItem(shared.NewID(), shared.NewID(), 1, roadmap.Content{Title: title}, roadmap.Planned, "V", time.Now())
	require.NoError(t, err)
	ctx := context.Background()
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	updated := title + "编辑"
	require.NoError(t, item.UpdateContent(roadmap.Content{Title: updated}, time.Now()))
	for _, event := range item.PullEvents() {
		require.NoError(t, subscriber.Handle(ctx, event))
	}
	resourceType := "roadmap_item"
	page, err := store.FindPage(ctx, domainaudit.ListFilter{ResourceType: &resourceType}, shared.PageQuery{Page: 1, Limit: 20})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)
	for _, entry := range page.Items {
		assert.Equal(t, item.ID().String(), entry.Resource.ID)
		assert.Len(t, []rune(entry.Resource.Name), 255)
		assert.Contains(t, entry.Summary, title)
	}
	assert.Contains(t, page.Items[0].Summary, updated)
}
