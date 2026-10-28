package gorm

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainlink "blog-api/internal/domain/linkpreview"
	domainshared "blog-api/internal/domain/shared"
)

func newCardRow(t *testing.T, url string, now time.Time) *domainlink.LinkCard {
	t.Helper()
	card, err := domainlink.NewLinkCard(domainshared.NewID(), url, now)
	require.NoError(t, err)
	return card
}

// TestLinkCardRepositoryIntegration_RoundTrip 全字段持久化往返。
func TestLinkCardRepositoryIntegration_RoundTrip(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewLinkCardRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()

	card := newCardRow(t, "https://example.com/a", now)
	card.RecordSuccess("标题", "描述", "Example", "/uploads/link-previews/x/cover.webp", now, domainlink.DefaultTTL)
	card.RecordFailure("upstream 5xx", now.Add(time.Minute))
	require.NoError(t, repo.Save(ctx, card))

	rows, err := repo.FindByURLs(ctx, []string{"https://example.com/a", "https://missing.example/"})
	require.NoError(t, err)
	require.Len(t, rows, 1)

	got := rows[0]
	require.Equal(t, card.ID(), got.ID())
	require.Equal(t, "https://example.com/a", got.URL())
	require.Equal(t, "标题", got.Title())
	require.Equal(t, "描述", got.Description())
	require.Equal(t, "Example", got.SiteName())
	require.Equal(t, "/uploads/link-previews/x/cover.webp", got.ImageURL())
	// 有旧快照的卡片失败后 status 保持 ok，failCount 递增。
	require.Equal(t, domainlink.StatusOK, got.Status())
	require.Equal(t, 1, got.FailCount())
	require.Equal(t, "upstream 5xx", got.LastError())
	require.WithinDuration(t, card.ExpiresAt(), got.ExpiresAt(), time.Second)
}

// TestLinkCardRepositoryIntegration_ConcurrentSaveMergesByUrl
// 并发抓取同一 URL 的双写按 url 唯一约束合并为一行（跨进程竞态兜底）。
func TestLinkCardRepositoryIntegration_ConcurrentSaveMergesByUrl(t *testing.T) {
	db := setupIntegrationDB(t)
	repo := NewLinkCardRepository(db)
	ctx := context.Background()
	now := time.Now().UTC()
	url := "https://example.com/dup"

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			card := newCardRow(t, url, now)
			card.RecordSuccess("并发快照", "", "", "", now, domainlink.DefaultTTL)
			require.NoError(t, repo.Save(ctx, card))
		}()
	}
	wg.Wait()

	rows, err := repo.FindByURLs(ctx, []string{url})
	require.NoError(t, err)
	require.Len(t, rows, 1, "同 URL 并发写应合并为一行")
	require.Equal(t, "并发快照", rows[0].Title())
}
