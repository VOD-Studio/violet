package post

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// View 是已持久化的浏览事件，不推断访问者身份或来源。
type View struct {
	// ID 浏览事件的唯一序号。
	ID int64
	// IPAddress 请求记录的 IP，可为空。
	IPAddress string
	// UserAgent 请求记录的 User-Agent，可为空。
	UserAgent string
	// CreatedAt 浏览事件发生时间。
	CreatedAt time.Time
}

type ViewRepository interface {
	// FindPage 包含回收站文章，硬删除或不存在的文章返回 ErrNotFound。
	FindPage(ctx context.Context, postID shared.ID, q shared.PageQuery) (shared.PageResult[View], error)
}
