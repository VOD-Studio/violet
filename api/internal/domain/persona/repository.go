package persona

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

var (
	// ErrNotFound 人设档案不存在。
	ErrNotFound = shared.NotFound("人设档案")
	// ErrNoActivePersona 站点尚未选择当前人设。
	ErrNoActivePersona = shared.NotFound("当前人设")
	// ErrVersionConflict 人设档案已被其他编辑窗口更新。
	ErrVersionConflict = shared.Conflict("人设档案已更新，请重新载入后再保存")
	// ErrActiveDelete 当前人设不能直接删除。
	ErrActiveDelete = shared.Conflict("当前人设不能删除，请先激活另一份人设档案")
)

// ListFilter 是后台人设列表筛选条件。
type ListFilter struct {
	// Search 按名称模糊匹配；空串表示不过滤。
	Search string
}

// Repository 是人设档案及当前选择关系的持久化接口。
type Repository interface {
	// Create 保存一个空人设档案。
	Create(ctx context.Context, persona *Persona) error
	// FindByID 查询完整人设档案。
	FindByID(ctx context.Context, id shared.ID) (*Persona, error)
	// FindByIDForUpdate 加行锁查询，供写事务使用。
	FindByIDForUpdate(ctx context.Context, id shared.ID) (*Persona, error)
	// FindPage 分页读取后台档案列表，当前人设优先。
	FindPage(ctx context.Context, filter ListFilter, query shared.PageQuery) (shared.PageResult[*Persona], error)
	// Save 按 expectedVersion 保存完整档案。
	Save(ctx context.Context, persona *Persona, expectedVersion int64) error
	// Delete 按 expectedVersion 永久删除档案。
	Delete(ctx context.Context, id shared.ID, expectedVersion int64) error
	// FindActiveID 返回当前人设 ID；尚未选择时返回 nil。
	FindActiveID(ctx context.Context) (*shared.ID, error)
	// SetActive 原子替换当前人设选择关系。
	SetActive(ctx context.Context, id shared.ID, activatedAt time.Time) error
}
