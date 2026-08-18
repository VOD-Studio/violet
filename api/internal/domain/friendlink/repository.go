package friendlink

import (
	"context"

	"blog-api/internal/domain/shared"
)

type FriendLinkRepository interface {
	// Save 保存友链（按主键 upsert，创建与更新共用）
	Save(ctx context.Context, f *FriendLink) error
	// FindByID 按 ID 查找，不存在返回 ErrNotFound
	FindByID(ctx context.Context, id shared.ID) (*FriendLink, error)
	// FindApproved 前台公开列表：仅 approved，按 sort_order 升序（同权重 created_at DESC）
	FindApproved(ctx context.Context) ([]*FriendLink, error)
	// FindPage 后台列表分页：按状态筛选（空串 = 全部），created_at DESC + id DESC tiebreaker
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*FriendLink], error)
	// CountPending 待审核计数（后台菜单角标）
	CountPending(ctx context.Context) (int64, error)
	// CountPendingByIdentity 业务配额：同一 (ip_hash, contact_email) 的 pending 申请数。
	// service 层据此判 409；DB 部分唯一索引兜底。
	CountPendingByIdentity(ctx context.Context, ipHash, contactEmail string) (int64, error)
	// ExistsActiveByURL URL 占用检查：存在非 rejected 记录占用该 url 即返回 true。
	// excludeID 非零时排除自身（后台编辑场景）；零值表示不排除。
	ExistsActiveByURL(ctx context.Context, url string, excludeID shared.ID) (bool, error)
	// Delete 物理删除，不存在返回 ErrNotFound
	Delete(ctx context.Context, id shared.ID) error
}

// ListFilter 友链列表筛选条件（FindPage 入参）。
type ListFilter struct {
	// Status 状态过滤，空串 = 不过滤（全部）
	Status string
}

// 领域错误
var (
	// ErrNotFound 友链不存在
	ErrNotFound = shared.NotFound("友链")
)
