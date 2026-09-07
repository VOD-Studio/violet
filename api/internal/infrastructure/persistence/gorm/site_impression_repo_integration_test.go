package gorm

import (
	"context"
	"sync"
	"testing"

	domainsiteimpression "blog-api/internal/domain/siteimpression"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSiteImpressionRepositoryConcurrentEnsureStoresOnlyDigest(t *testing.T) {
	db := setupIntegrationDB(t)
	require.NoError(t, db.Exec("DELETE FROM site_impressions").Error)
	t.Cleanup(func() { _ = db.Exec("DELETE FROM site_impressions").Error })

	repository := NewSiteImpressionRepository(db)
	rawToken := []byte("0123456789abcdef")
	hash := domainsiteimpression.NewTokenHash([]byte("site-impression-token-key"), rawToken)

	const requests = 24
	start := make(chan struct{})
	errors := make(chan error, requests)
	var wait sync.WaitGroup
	for range requests {
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-start
			errors <- repository.Ensure(context.Background(), hash)
		}()
	}
	close(start)
	wait.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}

	count, err := repository.Count(context.Background())
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	contained, err := repository.Contains(context.Background(), hash)
	require.NoError(t, err)
	assert.True(t, contained)

	var stored struct {
		TokenHash []byte `gorm:"column:token_hash"`
	}
	require.NoError(t, db.Raw("SELECT token_hash FROM site_impressions").Scan(&stored).Error)
	assert.Equal(t, hash[:], stored.TokenHash)
	assert.NotEqual(t, rawToken, stored.TokenHash)

	var columns []string
	require.NoError(t, db.Raw(`
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'site_impressions'
		ORDER BY ordinal_position
	`).Scan(&columns).Error)
	assert.Equal(t, []string{"token_hash", "created_at"}, columns)
}
