package post

import (
	"context"

	"blog-api/internal/domain/shared"
)

// OrderRepository 仅交换指定文章占用的顺序位置，不移动未提交的文章。
type OrderRepository interface {
	// Reorder 原子校验当前相对顺序、活跃状态与同一置顶层，再按 ordered 交换位置。
	// expected 与 ordered 必须包含相同的 2–100 个唯一 ID。
	Reorder(ctx context.Context, expected, ordered []shared.ID) error
}
