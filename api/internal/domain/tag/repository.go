package tag

import (
	"context"

	"blog-api/internal/domain/shared"
)

// TagRepository 标签仓储接口
type TagRepository interface {
	FindAll(ctx context.Context) ([]Tag, error)
	// FindPage 分页查找标签（按 id ASC）
	FindPage(ctx context.Context, q shared.PageQuery) (shared.PageResult[Tag], error)
	FindByID(ctx context.Context, id int32) (Tag, error)
	FindBySlug(ctx context.Context, slug string) (Tag, error)
	Save(ctx context.Context, t Tag) (int32, error)
	Delete(ctx context.Context, id int32) error
	ExistsBySlug(ctx context.Context, slug string) (bool, error)
}

var (
	ErrNotFound   = shared.NotFound("标签")
	ErrNameExists = shared.Conflict("标签已存在")
)
