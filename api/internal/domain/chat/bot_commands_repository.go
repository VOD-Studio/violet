package chat

import (
	"context"

	"blog-api/internal/domain/shared"
)

// BotCommandCatalogRepository 持久化 bot 的完整命令目录。
type BotCommandCatalogRepository interface {
	// Replace 仅在 revision 改变时覆盖目录；相同内容不推进更新时间。
	Replace(ctx context.Context, catalog BotCommandCatalog) error
	// ListByBotIDs 批量读取目录；未发布的 bot 不出现在结果中。
	ListByBotIDs(ctx context.Context, botIDs []shared.ID) (map[shared.ID]BotCommandCatalog, error)
}
