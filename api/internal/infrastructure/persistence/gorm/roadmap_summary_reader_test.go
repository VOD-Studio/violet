package gorm

import (
	"context"
	"testing"

	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoadmapSummaryReaderEmptyRequestDoesNotQuery(t *testing.T) {
	summaries, err := NewRoadmapSummaryReader(nil).ReadSummaries(context.Background(), []shared.ID{})
	require.NoError(t, err)
	assert.NotNil(t, summaries)
	assert.Empty(t, summaries)
}
