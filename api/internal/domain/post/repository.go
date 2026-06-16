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
}

// 领域错误
var (
	ErrNotFound     = shared.NotFound("文章")
	ErrSlugConflict = shared.Conflict("slug 已被占用")
)
