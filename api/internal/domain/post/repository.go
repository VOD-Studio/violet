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
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
	Save(ctx context.Context, p *Post) error
	Delete(ctx context.Context, id shared.ID) error
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
}

// 领域错误
var (
	ErrNotFound     = shared.NotFound("文章")
	ErrSlugConflict = shared.Conflict("slug 已被占用")
)
