package post

import (
	"context"

	"blog-api/internal/domain/shared"
)

// PostRepository 文章仓储接口
type PostRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Post, error)
	FindBySlug(ctx context.Context, slug string) (*Post, error)
	FindPublished(ctx context.Context, page, limit int, tag string) ([]*Post, int64, error)
	FindAll(ctx context.Context, page, limit int, status string) ([]*Post, int64, error)
	// Search 在 authorID 的文章内做大小写不敏感子串检索（title/excerpt/content_md 三列）。
	// query 空格分词、多词 AND；status 为空或 "all" 不过滤，否则按 draft/published/archived 过滤。
	// 按 updated_at 倒序，返回当前页结果与总数（has_more 由上层依 total 推导）。
	Search(ctx context.Context, authorID shared.ID, query, status string, page, limit int) ([]*Post, int64, error)
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
}

// 领域错误
var (
	ErrNotFound     = shared.NotFound("文章")
	ErrSlugConflict = shared.Conflict("slug 已被占用")
)
