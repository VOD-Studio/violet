package gallery

import (
	"context"

	"blog-api/internal/domain/shared"
)

var (
	// ErrNotFound 图集不存在。
	ErrNotFound = shared.NotFound("图集")
	// ErrNotOwner 操作者不是图集作者。
	ErrNotOwner = shared.Forbidden("只能访问自己创建的图集")
	// ErrVersionConflict 工作稿已被其他编辑窗口更新。
	ErrVersionConflict = shared.Conflict("图集工作稿已更新，请重新载入后再保存")
)

// Repository 图集聚合持久化接口。
type Repository interface {
	// Create 保存图集与初始空 working revision；调用方必须提供可延迟校验复合 FK 的事务。
	Create(ctx context.Context, gallery *Gallery) error
	// FindByID 查询图集及当前 working revision。
	FindByID(ctx context.Context, id shared.ID) (*Gallery, error)
	// FindByIDForUpdate 加行锁查询，供完整保存事务使用。
	FindByIDForUpdate(ctx context.Context, id shared.ID) (*Gallery, error)
	// FindPageByAuthor 分页读取作者自己的工作稿。
	FindPageByAuthor(ctx context.Context, authorID shared.ID, q shared.PageQuery) (shared.PageResult[*Gallery], error)
	// SaveWorking 保存完整 working revision，并以 expectedVersion 原子推进版本。
	SaveWorking(ctx context.Context, gallery *Gallery, expectedVersion int64) error
}
