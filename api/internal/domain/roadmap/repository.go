package roadmap

import (
	"context"

	"blog-api/internal/domain/shared"
)

var ErrNotFound = shared.NotFound("路线图条目")

type Repository interface {
	// WithinProject 锁定项目并在同一事务中运行 fn；fn 失败时回滚全部改动。
	WithinProject(ctx context.Context, projectID shared.ID, fn func(Repository) error) error
	FindByID(ctx context.Context, id shared.ID, includeDeleted bool) (*Item, error)
	// FindByProject 返回未删除条目；非完成阶段按位置，完成阶段按完成日期及编号倒序。
	FindByProject(ctx context.Context, projectID shared.ID) ([]*Item, error)
	// IsBlocked 读取两端活跃且来源未完成的 blocks 入边；写用例在保存后的同一事务中调用。
	IsBlocked(ctx context.Context, projectID, itemID shared.ID) (bool, error)
	// NextNumber 原子分配项目内编号；删除条目不能降低计数器。
	NextNumber(ctx context.Context, projectID shared.ID) (int64, error)
	Save(ctx context.Context, item *Item) error
}
