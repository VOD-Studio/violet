package chat

import (
	"context"

	domainshared "blog-api/internal/domain/shared"
)

// BotRepository bot 聚合的持久化端口。
//
// 鉴权路径用 FindByToken（tokenHash 比对）；管理路径用 FindByID / FindByUserID。
type BotRepository interface {
	// FindByID 按 bot ID 查找。不存在返回 ErrBotNotFound。
	FindByID(ctx context.Context, id domainshared.ID) (*Bot, error)
	// FindByUserID 按虚拟用户 ID 查找。不存在返回 ErrBotNotFound。
	// 管理后台「用户→bot」反查与 chat.Service 判定「sender 是否 bot」用。
	FindByUserID(ctx context.Context, userID domainshared.ID) (*Bot, error)
	// FindByToken 按 token 哈希查找。BotAuth 中间件鉴权用。
	// 不存在返回 ErrBotNotFound（鉴权失败映射 401）。
	FindByToken(ctx context.Context, tokenHash string) (*Bot, error)
	// ListByUserIDs 按虚拟用户 ID 批量查找 bot。
	// 事件分发用：一次查询判定会话成员里哪些是 bot，避免逐个 FindByUserID 的 N+1。
	// 非 bot 成员直接跳过，不报错；userIDs 为空返回空切片。
	ListByUserIDs(ctx context.Context, userIDs []domainshared.ID) ([]*Bot, error)
	// ListPage 分页列出全部 bot（管理后台，按创建时间倒序）。
	ListPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[*Bot], error)
	// Save 保存 bot（新增或全量更新）。tokenHash 必须已是哈希，不存明文。
	Save(ctx context.Context, bot *Bot) error
	// Delete 删除 bot。关联的虚拟用户不在此处理（由调用方决定是否级联）。
	Delete(ctx context.Context, id domainshared.ID) error
}

// ErrBotNotFound bot 不存在。
var ErrBotNotFound = domainshared.NotFound("Bot")
