package gallery

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// PublishedCursor 是公开流稳定排序键。
type PublishedCursor struct {
	// PublishedAt 首次发布时间。
	PublishedAt time.Time
	// ID 同一发布时间下的唯一排序键。
	ID shared.ID
}

// PublishedGallery 是只读公开快照，不暴露工作稿。
type PublishedGallery struct {
	// ID 图集唯一标识。
	ID shared.ID
	// Slug 稳定公开标识。
	Slug string
	// PublishedAt 首次发布时间。
	PublishedAt time.Time
	// Revision 当前公开快照。
	Revision *Revision
}

var (
	// ErrNotFound 图集不存在。
	ErrNotFound = shared.NotFound("图集")
	// ErrNotOwner 操作者不是图集作者。
	ErrNotOwner = shared.Forbidden("只能访问自己创建的图集")
	// ErrCannotMaintain 操作者既不是图集作者，也不具备 gallery:moderate 权限。
	ErrCannotMaintain = shared.Forbidden("只能维护自己创建的图集，或需要 gallery:moderate 权限")
	// ErrVersionConflict 工作稿已被其他编辑窗口更新。
	ErrVersionConflict = shared.Conflict("图集工作稿已更新，请重新载入后再保存")
	// ErrAlreadyPublished 表示工作稿已经是当前公开版本。
	ErrAlreadyPublished = shared.Conflict("图集工作稿已经是当前公开版本")
	// ErrNotPublished 表示图集当前没有可撤回的公开版本。
	ErrNotPublished = shared.Conflict("图集当前没有公开版本")
)

// ListFilter 管理列表筛选条件；零值表示不过滤。
type ListFilter struct {
	// AuthorID 只读该作者的图集；nil 表示全部作者。
	AuthorID *shared.ID
	// Status 取 StatusDraft、StatusPublished、StatusModified 或 StatusUnpublished；空串表示全部状态。
	Status string
}

// Repository 图集聚合持久化接口。
type Repository interface {
	// Create 保存图集与初始空 working revision；调用方必须提供可延迟校验复合 FK 的事务。
	Create(ctx context.Context, gallery *Gallery) error
	// FindByID 查询图集及当前 working revision。
	FindByID(ctx context.Context, id shared.ID) (*Gallery, error)
	// FindByIDForUpdate 加行锁查询，供完整保存事务使用。
	FindByIDForUpdate(ctx context.Context, id shared.ID) (*Gallery, error)
	// FindPage 按筛选条件分页读取管理列表，created_at、id 倒序。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*Gallery], error)
	// SaveWorking 保存完整 working revision，并以 expectedVersion 原子推进版本。
	SaveWorking(ctx context.Context, gallery *Gallery, expectedVersion int64) error
	// SavePublishingState 原子保存公开指针并删除已失效的旧公开快照。
	SavePublishingState(ctx context.Context, gallery *Gallery, obsoleteRevisionID *shared.ID, expectedVersion int64) error
	// Delete 按聚合版本永久删除图集。
	Delete(ctx context.Context, id shared.ID, expectedVersion int64) error
	// FindPublishedPage 按 published_at、id 倒序读取公开快照。
	FindPublishedPage(ctx context.Context, cursor *PublishedCursor, limit int) ([]PublishedGallery, error)
	// FindPublishedBySlug 只返回该 slug 的公开快照。
	FindPublishedBySlug(ctx context.Context, slug string) (PublishedGallery, error)
}
