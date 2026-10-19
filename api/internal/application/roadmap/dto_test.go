package roadmap

import (
	"testing"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 新建时的时间带着进程时区，从数据库读回的是 UTC；DTO 统一写成 UTC，同一条目前后返回一致。
func TestDTOTimestampsAreUTC(t *testing.T) {
	now := time.Date(2026, 10, 19, 19, 56, 52, 0, time.FixedZone("CST", 8*3600))
	item, err := domain.NewItem(shared.NewID(), shared.NewID(), 1, domain.Content{Title: "条目"}, domain.Planned, "V", now)
	require.NoError(t, err)
	relation, err := domain.NewRelation(shared.NewID(), shared.NewID(), shared.NewID(), shared.NewID(), domain.RelationExtends, now)
	require.NoError(t, err)

	dto := toDTO(item)
	assert.Equal(t, "2026-10-19T11:56:52Z", dto.CreatedAt)
	assert.Equal(t, "2026-10-19T11:56:52Z", dto.UpdatedAt)
	assert.Equal(t, "2026-10-19T11:56:52Z", relationToDTO(relation).CreatedAt)
}
