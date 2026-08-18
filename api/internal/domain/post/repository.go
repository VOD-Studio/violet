package post

import (
	"context"

	"blog-api/internal/domain/shared"
)

// PostRepository 文章仓储接口
type PostRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Post, error)
	FindBySlug(ctx context.Context, slug string) (*Post, error)
	// FindPage 分页列出文章（统一入口，筛选与排序语义见 ListFilter 字段注释）。
	//
	// 各场景排序互不相同（发布列表看 published_at、后台看 created_at、检索看
	// updated_at），由 ListFilter.Sort 显式指定，避免按筛选维度隐式推导。
	FindPage(ctx context.Context, filter ListFilter, q shared.PageQuery) (shared.PageResult[*Post], error)
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
	Save(ctx context.Context, p *Post) error
	Delete(ctx context.Context, id shared.ID) error
	Restore(ctx context.Context, id shared.ID) error
	HardDelete(ctx context.Context, id shared.ID) error
	// IncrementViewAtomic 原子地浏览量+1 并记录浏览事件（单事务，保证一致性）。
	// 在 DB 内用 UPDATE ... SET view_count = view_count + 1，避免读-改-写竞态；
	// 同时写入 post_views 事件行，两者在同一事务内提交。
	IncrementViewAtomic(ctx context.Context, postID shared.ID, ipAddress, userAgent string) error
	// FindArchiveYears 返回所有含已发布文章的年份（倒序、去重）。
	// 供公开归档页生成年份索引。
	FindArchiveYears(ctx context.Context) ([]int, error)
	// FindPublishedByYear 返回指定年份的全部已发布文章（按 published_at 倒序）。
	// 供公开归档页按年懒加载，结果在应用层/前端再按月分组。
	FindPublishedByYear(ctx context.Context, year int) ([]*Post, error)

	// --- 历史版本控制 ---
	SaveVersion(ctx context.Context, version *PostVersion) error
	FindVersionsByPostID(ctx context.Context, postID shared.ID) ([]*PostVersion, error)
	GetVersionByID(ctx context.Context, versionID shared.ID) (*PostVersion, error)
	// FindCollaboratorIDsByPostID 返回该文章的协同者 ID（按首次编辑时间升序、去重、排除 owner）。
	// 协同者 = 在 post_versions.editor_id 出现过且不等于 posts.author_id 的用户。
	// 从版本历史去重衍生，无独立关联表。
	FindCollaboratorIDsByPostID(ctx context.Context, postID shared.ID) ([]shared.ID, error)
	// FindCollaboratorIDsByPostIDs 批量返回多篇文章的协同者 ID。
	// 返回 map[postID][]collaboratorID，每个 post 内的 ID 按首次编辑时间升序、去重、排除 owner。
	FindCollaboratorIDsByPostIDs(ctx context.Context, postIDs []shared.ID) (map[string][]shared.ID, error)
	// BatchGetByIDs 批量按 ID 查文章（Unscoped，含软删除行）。
	BatchGetByIDs(ctx context.Context, ids []shared.ID) ([]*Post, error)
}

// 领域错误
var (
	ErrNotFound     = shared.NotFound("文章")
	ErrSlugConflict = shared.Conflict("slug 已被占用")
)

// ListFilter 文章列表筛选条件（FindPage 入参，维度正交组合）。
//
// 由调用方按场景组装：前台发布列表传 Status=published + SortPublished（可带
// Tags 单标签）；后台管理传 Status（trashed 取回收站）+ Keyword/Tags +
// SortCreatedAt；检索场景传 Keyword + AuthorID + SortUpdated。
type ListFilter struct {
	// Status 状态过滤：draft/published/archived 按 status 列过滤；空串或 "all" 不过滤；
	// "trashed" 切 Unscoped 取软删除行（回收站视图）
	Status string
	// Tags 标签 slug 列表（AND 关系，文章须同时关联全部标签）；前台单标签浏览传单元素
	Tags []string
	// Keyword 关键词检索（空格分词多关键词 AND，命中 title/excerpt/content_md 三列，大小写不敏感），空串 = 不过滤
	Keyword string
	// AuthorID 限定作者（检索自己的文章），nil = 不限作者
	AuthorID *shared.ID
	// Sort 排序键，见 SortXxx 常量；空串 = SortCreatedAt
	Sort string
}

// 列表排序键（ListFilter.Sort；各场景排序语义不同，显式指定而非按筛选推导）。
const (
	// SortPublished 前台发布列表：精选优先，再按发布时间倒序
	SortPublished = "published"
	// SortCreatedAt 后台管理列表：创建时间倒序
	SortCreatedAt = "created_at"
	// SortUpdated 检索场景：更新时间倒序（最近改过的最相关，与后台的 created_at 区分）
	SortUpdated = "updated_at"
)
