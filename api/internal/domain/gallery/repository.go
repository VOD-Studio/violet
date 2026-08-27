package gallery

import (
	"context"

	"blog-api/internal/domain/shared"
)

// GalleryRepository 图集仓储。
//
// 聚合持久化（galleries + gallery_items 两表）的完整契约：
// Save 为根字段 upsert + items 全量替换（position 按切片顺序写入）；
// 删除为物理删（items 行由 FK 级联，媒体引用计数解绑是应用层职责）。
type GalleryRepository interface {
	// Save 保存图集（存在则更新，不存在则插入）
	Save(ctx context.Context, g *Gallery) error
	// FindByID 按 ID 查找（含 items，按 position 升序）
	FindByID(ctx context.Context, id shared.ID) (*Gallery, error)
	// FindPublishedPage 公开浏览流分页：仅 published，created_at DESC + id DESC tiebreaker
	FindPublishedPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*Gallery], error)
	// FindPageByOwner 用户主页分页：该作者全部 published 图集，created_at DESC
	FindPageByOwner(ctx context.Context, ownerID shared.ID, q shared.PageQuery) (shared.PageResult[*Gallery], error)
	// FindAdminPage 管理列表分页：全部状态，created_at DESC
	FindAdminPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[*Gallery], error)
	// Delete 物理删除图集（gallery_items 行由 FK ON DELETE CASCADE 清理）
	Delete(ctx context.Context, id shared.ID) error
}
