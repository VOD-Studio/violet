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

	// Count 分组总数（seed 判断是否首次启动用）
	Count(ctx context.Context) (int64, error)

	// FindGroupsNeedingCover 查询指定来源下封面为空或仍是远程 http URL 的分组（seed 回填用）
	FindGroupsNeedingCover(ctx context.Context, source string) ([]*EmojiGroup, error)

	// UpdateCoverURL 局部更新分组封面 URL（seed 回填用，避免整体 Save 覆盖）
	UpdateCoverURL(ctx context.Context, id int32, coverURL string) error

	// UpsertByName 按名称合并分组：存在则更新（cover/sort/enabled），不存在则新建。
	// name 有全局唯一约束，按 name 单字段匹配。用于 B站表情重新拉取增量合并，不删除历史分组。
	UpsertByName(ctx context.Context, g *EmojiGroup) (int32, error)
	// UpsertEmojiByName 按 groupID+name 合并表情：存在则更新，不存在则新建。返回表情 ID。
	UpsertEmojiByName(ctx context.Context, e Emoji) (int32, error)
}

var (
	ErrNotFound      = shared.NotFound("表情分组")
	ErrNameExists    = shared.Conflict("分组名称已存在")
	ErrEmojiNotFound = shared.NotFound("表情")
)
