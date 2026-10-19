package roadmap

import (
	"context"

	"blog-api/internal/domain/shared"
)

var ErrRelationNotFound = shared.NotFound("路线图条目关系")

type RelationRepository interface {
	// WithinProject 与条目仓储锁定同一项目；fn 内的读写使用同一个事务。
	WithinProject(ctx context.Context, projectID shared.ID, fn func(RelationRepository) error) error
	FindItem(ctx context.Context, id shared.ID, includeDeleted bool) (*Item, error)
	FindByID(ctx context.Context, projectID, id shared.ID) (*Relation, error)
	// FindByProject 的 includeHidden=true 供环检测使用，包含软删除条目关联的关系。
	FindByProject(ctx context.Context, projectID shared.ID, includeHidden bool) ([]*Relation, error)
	Create(ctx context.Context, relation *Relation) error
	// Delete 显式删除关系记录，不受两端条目软删除状态影响。
	Delete(ctx context.Context, projectID, id shared.ID) error
}
