// Package tag 提供标签的领域模型。
package tag

import (
	"context"

	"blog-api/internal/domain/shared"
)

// Tag 标签实体
type Tag struct {
	id   int32
	name string
	slug string
}

// NewTag 创建标签（自动生成 slug 由 application 层完成）
func NewTag(id int32, name, slug string) Tag {
	return Tag{id: id, name: name, slug: slug}
}

func (t Tag) ID() int32    { return t.id }
func (t Tag) Name() string { return t.name }
func (t Tag) Slug() string { return t.slug }

// TagRepository 标签仓储接口
type TagRepository interface {
	FindAll(ctx context.Context) ([]Tag, error)
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
