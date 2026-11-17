package post

import (
	"context"
	"strconv"
	"time"

	"blog-api/internal/domain/permission"
	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type ViewDTO struct {
	// ID 以十进制字符串返回，避免浏览器丢失 bigint 精度。
	ID        string    `json:"id"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

type ViewQuery struct {
	repo domain.ViewRepository
	perm PostPermissionChecker
}

func NewViewQuery(repo domain.ViewRepository, perm PostPermissionChecker) *ViewQuery {
	return &ViewQuery{repo: repo, perm: perm}
}

func (q *ViewQuery) List(ctx context.Context, rawID string, page shared.PageQuery) (shared.PageResult[ViewDTO], error) {
	isRoot := middleware.GetUserIsRoot(ctx)
	if !isRoot && (q.perm == nil || !q.perm.HasPermission(middleware.GetUserRole(ctx), isRoot, permission.PostView.String())) {
		return shared.PageResult[ViewDTO]{}, shared.Forbidden("无权查看文章浏览记录")
	}
	id, err := shared.ParseID(rawID)
	if err != nil {
		return shared.PageResult[ViewDTO]{}, err
	}
	result, err := q.repo.FindPage(ctx, id, page.Normalize())
	if err != nil {
		return shared.PageResult[ViewDTO]{}, err
	}
	items := make([]ViewDTO, len(result.Items))
	for i, view := range result.Items {
		items[i] = ViewDTO{ID: strconv.FormatInt(view.ID, 10), IPAddress: view.IPAddress, UserAgent: view.UserAgent, CreatedAt: view.CreatedAt}
	}
	return shared.NewPageResult(shared.PageQuery{Page: result.Page, Limit: result.Limit}, items, result.Total), nil
}
