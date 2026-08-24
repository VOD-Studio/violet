package customemoji

import (
	"context"

	"blog-api/internal/domain/shared"
)

// Repository 自定义表情持久化端口，涵盖表情自身与收藏关系两组操作。
//
// 收藏关系（custom_emoji_favorites）不建模成 CustomEmoji 聚合内部集合——它是
// 「谁收藏了谁的表情」的多对多关系，不属于表情自身的不变量，故收藏读写方法与
// 表情 CRUD 方法并列在同一端口，而非拆成第二个聚合（镶镜 PRD-0020 设计决策）。
type Repository interface {
	// Save 保存新创建的自定义表情。
	Save(ctx context.Context, e *CustomEmoji) error
	// FindByID 按 ID 查找单条（含已软删除，调用方按 IsUsable 判断可用性；
	// 行完全不存在才返回 ErrNotFound）。供 owner/权限校验类流程使用。
	FindByID(ctx context.Context, id shared.ID) (*CustomEmoji, error)
	// FindByIDs 批量按 ID 查找，仅返回未软删除的记录（下架/不存在的 ID 静默跳过，
	// 不报错）。供共享 resolver ResolveByIDs 使用。
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*CustomEmoji, error)
	// ExistsByOwnerAndName 同一 ownerID 下是否已存在同名未软删除表情（创建前查重）。
	ExistsByOwnerAndName(ctx context.Context, ownerID shared.ID, name string) (bool, error)
	// CountOwned 统计用户自传的未软删除表情数量（份额校验用）。
	CountOwned(ctx context.Context, ownerID shared.ID) (int64, error)
	// ListOwned 列出用户自传的未软删除表情，按创建时间倒序（我的表情 tab「我传的」分组）。
	ListOwned(ctx context.Context, ownerID shared.ID) ([]*CustomEmoji, error)
	// Delete 持久化软删除状态（自行删除或管理员下架，由调用方决定谁能调用）。
	Delete(ctx context.Context, e *CustomEmoji) error

	// AddFavorite 收藏一个表情（幂等：已收藏不报错，不产生重复行）。
	AddFavorite(ctx context.Context, userID, emojiID shared.ID) error
	// RemoveFavorite 移出收藏（幂等：未收藏不报错）。
	RemoveFavorite(ctx context.Context, userID, emojiID shared.ID) error
	// IsFavorited 用户是否收藏了指定表情。
	IsFavorited(ctx context.Context, userID, emojiID shared.ID) (bool, error)
	// CountFavorited 统计用户收藏的未软删除表情数量（份额校验用，与 CountOwned 合计）。
	CountFavorited(ctx context.Context, userID shared.ID) (int64, error)
	// ListFavorited 列出用户收藏的未软删除表情，按收藏时间倒序（我的表情 tab「收藏来的」分组）。
	ListFavorited(ctx context.Context, userID shared.ID) ([]*CustomEmoji, error)
	// FindFavoritedIDs 批量判断 userID 对 emojiIDs 中每个 ID 的收藏状态（ResolveByIDs 批量解析用）。
	FindFavoritedIDs(ctx context.Context, userID shared.ID, emojiIDs []shared.ID) (map[shared.ID]bool, error)
}

var (
	// ErrNotFound 自定义表情行完全不存在（区别于「已软删除」）。
	ErrNotFound = shared.NotFound("自定义表情")
	// ErrNameExists 同一用户下表情名称已存在。
	ErrNameExists = shared.Conflict("表情名称已存在")
	// ErrQuotaExceeded 表情份额（自传+收藏合计）已达上限。
	ErrQuotaExceeded = shared.BadRequest("表情数量已达上限，请先清理旧的")
	// ErrFavoriteOwnEmoji 不能收藏自己上传的表情（无意义操作）。
	ErrFavoriteOwnEmoji = shared.BadRequest("不能收藏自己上传的表情")
)
