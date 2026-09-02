package note

import (
	"context"

	"blog-api/internal/domain/shared"
)

// BrowseFilter 公开流筛选条件；零值表示不过滤。
type BrowseFilter struct {
	// TagSlug 只读挂该标签（按 slug）的笔记；空串表示全部。
	TagSlug string
}

// ListFilter 管理列表筛选条件；零值表示不过滤。
type ListFilter struct {
	// AuthorID 只读该作者的笔记；nil 表示全部作者。
	AuthorID *shared.ID
	// Status 取 StatusDraft 或 StatusPublished；空串表示全部状态。
	Status string
}

// Repository 笔记聚合持久化接口。
type Repository interface {
	// Create 保存新笔记（含标签关联，事务内）。
	Create(ctx context.Context, n *Note) error
	// FindByID 查询笔记（含草稿）及标签快照。
	FindByID(ctx context.Context, id shared.ID) (*Note, error)
	// Save 全量保存编辑结果（含标签关联替换，事务内）。
	Save(ctx context.Context, n *Note) error
	// Delete 物理删除笔记（note_tags 级联）。
	Delete(ctx context.Context, id shared.ID) error
	// FindPage 按筛选条件分页读取管理列表，created_at、id 倒序。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*Note], error)
	// FindPublishedPage 按 published_at、id 倒序读取公开笔记。
	FindPublishedPage(ctx context.Context, cursor *PublishedCursor, filter BrowseFilter, limit int) ([]PublishedNote, error)
	// FindPublishedByID 只返回该 ID 的已发布笔记；草稿按不存在处理。
	FindPublishedByID(ctx context.Context, id shared.ID) (PublishedNote, error)
}
