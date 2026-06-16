package emoji

import (
	"context"

	"blog-api/internal/domain/shared"
)

// EmojiGroupRepository 表情分组仓储接口
type EmojiGroupRepository interface {
	FindByID(ctx context.Context, id int32) (*EmojiGroup, error)
	FindAll(ctx context.Context, enabledOnly bool) ([]*EmojiGroup, error)
	FindByName(ctx context.Context, name string) (*EmojiGroup, error)
	Save(ctx context.Context, g *EmojiGroup) (int32, error)
	Delete(ctx context.Context, id int32) error
	UpdateEnabled(ctx context.Context, id int32, enabled bool) error
}

var (
	ErrNotFound   = shared.NotFound("表情分组")
	ErrNameExists = shared.Conflict("分组名称已存在")
)
