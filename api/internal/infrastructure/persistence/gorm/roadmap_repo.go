package gorm

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	domainproject "blog-api/internal/domain/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RoadmapRepository struct{ db *gorm.DB }

func NewRoadmapRepository(db *gorm.DB) *RoadmapRepository { return &RoadmapRepository{db: db} }

func (r *RoadmapRepository) WithinProject(ctx context.Context, projectID shared.ID, fn func(domain.Repository) error) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var project model.Project
		if err := tx.Select("id").Clauses(clause.Locking{Strength: "UPDATE"}).
			Take(&project, "id = ?", projectID.UUID()).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domainproject.ErrNotFound
			}
			return shared.Internal("锁定路线图项目失败", err)
		}
		return fn(NewRoadmapRepository(tx))
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
}

func (r *RoadmapRepository) FindByID(ctx context.Context, id shared.ID, includeDeleted bool) (*domain.Item, error) {
	q := r.db.WithContext(ctx).Where("id = ?", id.UUID())
	if !includeDeleted {
		q = q.Where("deleted_at IS NULL")
	}
	var po model.RoadmapItem
	if err := q.Take(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, domain.ErrNotFound
		}
		return nil, shared.Internal("查询路线图条目失败", err)
	}
	return roadmapPOToDomain(po)
}

func (r *RoadmapRepository) FindByProject(ctx context.Context, projectID shared.ID) ([]*domain.Item, error) {
	var pos []model.RoadmapItem
	if err := r.db.WithContext(ctx).Where("project_id = ? AND deleted_at IS NULL", projectID.UUID()).
		Order("CASE stage WHEN 'planned' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END").
		Order("CASE WHEN stage = 'completed' THEN completion_date END DESC").
		Order("CASE WHEN stage = 'completed' THEN number END DESC").
		Order("position ASC, number ASC").Find(&pos).Error; err != nil {
		return nil, shared.Internal("查询路线图失败", err)
	}
	items := make([]*domain.Item, 0, len(pos))
	for _, po := range pos {
		item, err := roadmapPOToDomain(po)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (r *RoadmapRepository) NextNumber(ctx context.Context, projectID shared.ID) (int64, error) {
	var number int64
	if err := r.db.WithContext(ctx).Raw(`INSERT INTO roadmap_item_counters (project_id, last_number)
		VALUES (?, 1) ON CONFLICT (project_id) DO UPDATE
		SET last_number = roadmap_item_counters.last_number + 1 RETURNING last_number`, projectID.UUID()).
		Scan(&number).Error; err != nil {
		return 0, shared.Internal("分配路线图条目编号失败", err)
	}
	return number, nil
}

func (r *RoadmapRepository) Save(ctx context.Context, item *domain.Item) error {
	tags, _ := json.Marshal(item.Tags())
	links, _ := json.Marshal(item.Links())
	po := model.RoadmapItem{
		BaseModel: model.BaseModel{ID: item.ID().UUID(), CreatedAt: item.CreatedAt(), UpdatedAt: item.UpdatedAt()},
		ProjectID: item.ProjectID().UUID(), Number: item.Number(), Title: item.Title(),
		Description: item.Description(), Stage: string(item.Stage()), Position: item.Position(),
		Tags: string(tags), Links: string(links), CompletionDate: item.CompletionDate(),
		DeliveredVersion: item.DeliveredVersion(), DeletedAt: item.DeletedAt(),
	}
	if err := r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "id"}},
		DoUpdates: clause.AssignmentColumns([]string{"title", "description", "stage", "position", "tags", "links",
			"completion_date", "delivered_version", "deleted_at", "updated_at"}),
	}).Create(&po).Error; err != nil {
		return shared.Internal("保存路线图条目失败", err)
	}
	return nil
}

func roadmapPOToDomain(po model.RoadmapItem) (*domain.Item, error) {
	var tags []string
	var links []domain.Link
	if err := json.Unmarshal([]byte(po.Tags), &tags); err != nil {
		return nil, shared.Internal("读取路线图条目标签失败", err)
	}
	if err := json.Unmarshal([]byte(po.Links), &links); err != nil {
		return nil, shared.Internal("读取路线图关联链接失败", err)
	}
	return domain.ReconstructItem(domain.ItemState{
		ID: shared.IDFromUUID(po.ID), ProjectID: shared.IDFromUUID(po.ProjectID), Number: po.Number,
		Content: domain.Content{Title: po.Title, Description: po.Description, Tags: tags, Links: links,
			CompletionDate: po.CompletionDate, DeliveredVersion: po.DeliveredVersion},
		Stage: domain.Stage(po.Stage), Position: po.Position, DeletedAt: po.DeletedAt,
		CreatedAt: po.CreatedAt, UpdatedAt: po.UpdatedAt,
	}), nil
}

var _ domain.Repository = (*RoadmapRepository)(nil)
