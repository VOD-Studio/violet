package customemoji

import (
	"context"

	"blog-api/internal/domain/shared"
)

// Repository 自定义表情与收藏关系的持久化端口。
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
	// FindPageWithOwner 分页列出全部用户的未软删除表情并关联上传者信息
	// （后台管理读模型，跨 owner）。keyword 非空时按表情名/上传者用户名/展示名
	// ILIKE 模糊匹配（OR 关系）；按创建时间倒序。
	FindPageWithOwner(ctx context.Context, keyword string, q shared.PageQuery) (shared.PageResult[*CustomEmojiWithOwner], error)

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

// QuotaRepository 在持久化层以用户级事务锁原子执行份额校验与写入。
type QuotaRepository interface {
	SaveWithQuota(ctx context.Context, e *CustomEmoji, maxPerUser int64) error
	AddFavoriteWithQuota(ctx context.Context, userID, emojiID shared.ID, maxPerUser int64) error
}
// OwnerRef 上传者只读视图（后台管理列表展示上传者用）。
type OwnerRef struct {
	// ID 上传者用户 ID
	ID shared.ID
	// Username 上传者用户名
	Username string
	// DisplayName 上传者展示名（可能为空，展示侧自行回退 Username）
	DisplayName string
	// AvatarURL 上传者头像地址（可能为空）
	AvatarURL string
}

// CustomEmojiWithOwner 自定义表情 + 上传者视图（后台管理读模型）。
type CustomEmojiWithOwner struct {
	// Emoji 自定义表情
	Emoji *CustomEmoji
	// Owner 上传者只读视图
	Owner OwnerRef
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
