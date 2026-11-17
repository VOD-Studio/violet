package post

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

func TestBatchFeaturedRequiresPublishPermission(t *testing.T) {
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, shared.NewID().String())
	for _, action := range []string{"feature", "unfeature"} {
		t.Run(action, func(t *testing.T) {
			svc := &Service{perm: &orderPermissionStub{allowed: false}}
			affected, err := svc.BatchAction(ctx, BatchActionInput{IDs: []string{shared.NewID().String()}, Action: action})
			require.Error(t, err)
			assert.Contains(t, err.Error(), "无权设置精选")
			assert.Zero(t, affected)
		})
	}
}
