package comment

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

func TestListByPostSortPreservesAnonymousBlackhole(t *testing.T) {
	svc := &Service{}
	for _, sort := range []string{"", "latest", "hot"} {
		items, total, err := svc.ListByPost(context.Background(), shared.NewID().String(), "", "", domain.AnchorFilterFree, domain.DepthFilterTopLevel, "", sort, 1, 20)
		require.NoError(t, err)
		require.NotNil(t, items)
		require.Empty(t, items)
		require.Zero(t, total)
	}
	_, _, err := svc.ListByPost(context.Background(), shared.NewID().String(), "", "", domain.AnchorFilterFree, domain.DepthFilterTopLevel, "", "desc", 1, 20)
	require.Error(t, err, "即使匿名黑洞也必须拒绝非法排序")
}
