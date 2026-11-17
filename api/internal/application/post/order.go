package post

import (
	"context"

	"blog-api/internal/domain/permission"
	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

// ReorderInput 只包含本次可见分组，未列出的文章保持位置不变。
type ReorderInput struct {
	ExpectedIDs []string `json:"expected_ids"`
	IDs         []string `json:"ids"`
}

type OrderService struct {
	repo domain.OrderRepository
	perm PostPermissionChecker
}

func NewOrderService(repo domain.OrderRepository, perm PostPermissionChecker) *OrderService {
	return &OrderService{repo: repo, perm: perm}
}

func (s *OrderService) Reorder(ctx context.Context, in ReorderInput) error {
	isRoot := middleware.GetUserIsRoot(ctx)
	if !isRoot && (s.perm == nil || !s.perm.HasPermission(middleware.GetUserRole(ctx), isRoot, permission.PostPublish.String())) {
		return shared.Forbidden("无权调整文章顺序")
	}
	if len(in.IDs) < 2 || len(in.IDs) > 100 || len(in.ExpectedIDs) != len(in.IDs) {
		return shared.BadRequest("排序须包含同一分组的 2–100 篇文章")
	}
	expected := make([]shared.ID, len(in.ExpectedIDs))
	ordered := make([]shared.ID, len(in.IDs))
	ids := make(map[shared.ID]bool, len(in.IDs))
	for i, raw := range in.ExpectedIDs {
		id, err := shared.ParseID(raw)
		if err != nil {
			return err
		}
		if ids[id] {
			return shared.BadRequest("排序包含重复文章")
		}
		ids[id] = true
		expected[i] = id
	}
	for i, raw := range in.IDs {
		id, err := shared.ParseID(raw)
		if err != nil {
			return err
		}
		if !ids[id] {
			return shared.BadRequest("排序前后的文章集合必须相同且不重复")
		}
		delete(ids, id)
		ordered[i] = id
	}
	return s.repo.Reorder(ctx, expected, ordered)
}
