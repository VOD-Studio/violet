package gorm

import (
	"context"
	"database/sql"
	"errors"

	domainproject "blog-api/internal/domain/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RoadmapRelationRepository struct{ db *gorm.DB }

func NewRoadmapRelationRepository(db *gorm.DB) *RoadmapRelationRepository {
	return &RoadmapRelationRepository{db: db}
}

func (r *RoadmapRelationRepository) WithinProject(ctx context.Context, projectID shared.ID, fn func(domain.RelationRepository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Select("id").Clauses(clause.Locking{Strength: "UPDATE"}).
			Take(&project, "id = ?", projectID.UUID()).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domainproject.ErrNotFound
			}
			return shared.Internal("锁定条目关系项目失败", err)
		}
		return fn(NewRoadmapRelationRepository(tx))
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
}

func (r *RoadmapRelationRepository) FindItem(ctx context.Context, id shared.ID, includeDeleted bool) (*domain.Item, error) {
	return NewRoadmapRepository(r.db).FindByID(ctx, id, includeDeleted)
}

func (r *RoadmapRelationRepository) FindByID(ctx context.Context, projectID, id shared.ID) (*domain.Relation, error) {
	var po model.RoadmapRelation
	if err := r.db.WithContext(ctx).Take(&po, "project_id = ? AND id = ?", projectID.UUID(), id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrRelationNotFound
		}
		return nil, shared.Internal("查询条目关系失败", err)
	}
	return roadmapRelationPOToDomain(po), nil
}

func (r *RoadmapRelationRepository) FindByProject(ctx context.Context, projectID shared.ID, includeHidden bool) ([]*domain.Relation, error) {
	query := r.db.WithContext(ctx).Model(&model.RoadmapRelation{}).
		Select("roadmap_relations.*").Where("roadmap_relations.project_id = ?", projectID.UUID())
	if !includeHidden {
		query = query.Joins("JOIN roadmap_items AS source ON source.id = roadmap_relations.source_id AND source.deleted_at IS NULL").
			Joins("JOIN roadmap_items AS target ON target.id = roadmap_relations.target_id AND target.deleted_at IS NULL")
	}
	var pos []model.RoadmapRelation
	if err := query.Order("roadmap_relations.created_at ASC, roadmap_relations.id ASC").Find(&pos).Error; err != nil {
		return nil, shared.Internal("查询条目关系列表失败", err)
	}
	relations := make([]*domain.Relation, 0, len(pos))
	for _, po := range pos {
		relations = append(relations, roadmapRelationPOToDomain(po))
	}
	return relations, nil
}

func (r *RoadmapRelationRepository) Create(ctx context.Context, relation *domain.Relation) error {
	po := model.RoadmapRelation{
		ID: relation.ID().UUID(), ProjectID: relation.ProjectID().UUID(),
		SourceID: relation.SourceID().UUID(), TargetID: relation.TargetID().UUID(),
		Type: string(relation.Type()), CreatedAt: relation.CreatedAt(),
	}
	if err := r.db.WithContext(ctx).Create(&po).Error; err != nil {
		var state interface{ SQLState() string }
		if errors.Is(err, gorm.ErrDuplicatedKey) || (errors.As(err, &state) && state.SQLState() == "23505") {
			return shared.Conflict("同类型的条目关系已存在")
		}
		return shared.Internal("创建条目关系失败", err)
	}
	return nil
}

func (r *RoadmapRelationRepository) Delete(ctx context.Context, projectID, id shared.ID) error {
	result := r.db.WithContext(ctx).Where("project_id = ? AND id = ?", projectID.UUID(), id.UUID()).Delete(&model.RoadmapRelation{})
	if result.Error != nil {
		return shared.Internal("删除条目关系失败", result.Error)
	}
	if result.RowsAffected == 0 {
		return domain.ErrRelationNotFound
	}
	return nil
}

func roadmapRelationPOToDomain(po model.RoadmapRelation) *domain.Relation {
	return domain.ReconstructRelation(shared.IDFromUUID(po.ID), shared.IDFromUUID(po.ProjectID),
		shared.IDFromUUID(po.SourceID), shared.IDFromUUID(po.TargetID), domain.RelationType(po.Type), po.CreatedAt)
}

var _ domain.RelationRepository = (*RoadmapRelationRepository)(nil)
