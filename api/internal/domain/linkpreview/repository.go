package linkpreview

import (
	"context"

	"blog-api/internal/domain/shared"
)

// LinkCardRepository 链接卡片仓储契约。
type LinkCardRepository interface {
	// Save 保存卡片（按 id upsert）。url 唯一冲突（并发抓取同一 URL 的双写）按 url 合并更新。
	Save(ctx context.Context, card *LinkCard) error

	// FindByURLs 按 URL 批量查找；入参去重后查询，结果数量 ≤ 入参数量。
	FindByURLs(ctx context.Context, urls []string) ([]*LinkCard, error)
}

// IDGenerator 供应用层登记新 URL 时发号（生产用 shared.NewID，测试注入固定值）。
type IDGenerator func() shared.ID
