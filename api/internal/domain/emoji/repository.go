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
	// BatchUpdateEnabled 批量更新分组启用状态
	BatchUpdateEnabled(ctx context.Context, ids []int32, enabled bool) (int64, error)
	// ExistsByName 名称是否已存在（排除自身，用于更新查重）
	ExistsByName(ctx context.Context, name string, excludeID int32) (bool, error)

	// 单 emoji CRUD
	FindEmojisByGroup(ctx context.Context, groupID int32) ([]Emoji, error)
	FindEmojiByID(ctx context.Context, id int32) (Emoji, error)
	SaveEmoji(ctx context.Context, e Emoji) (int32, error)
	DeleteEmoji(ctx context.Context, id int32) error
}

var (
	ErrNotFound      = shared.NotFound("表情分组")
	ErrNameExists    = shared.Conflict("分组名称已存在")
	ErrEmojiNotFound = shared.NotFound("表情")
)
