package roadmap

import (
	"context"
	"time"

	domain "blog-api/internal/domain/roadmap"
)

type Option func(*Service)

// WithRelations 为公开详情提供当前可见关系及被阻塞投影。
func WithRelations(reader RelationReader) Option {
	return func(service *Service) { service.relations = reader }
}

type RelationDTO struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	SourceID  string `json:"source_id"`
	TargetID  string `json:"target_id"`
	// Type extends、fixes 或 blocks；方向按对应类型解释。
	Type      string `json:"type"`
	CreatedAt string `json:"created_at"`
}

type CreateRelationInput struct {
	SourceID string
	TargetID string
	// Type extends、fixes 或 blocks。
	Type string
}

type RelationReader interface {
	List(ctx context.Context, projectID string) ([]RelationDTO, error)
}

// EnrichRelations 返回两端均在本次条目集合中的关系，并由这些关系派生被阻塞标记。
func EnrichRelations(items []ItemDTO, relations []RelationDTO) []RelationDTO {
	byID := make(map[string]int, len(items))
	for index := range items {
		items[index].Blocked = false
		byID[items[index].ID] = index
	}
	visible := make([]RelationDTO, 0, len(relations))
	for _, relation := range relations {
		source, sourceExists := byID[relation.SourceID]
		target, targetExists := byID[relation.TargetID]
		if !sourceExists || !targetExists {
			continue
		}
		visible = append(visible, relation)
		if relation.Type == string(domain.RelationBlocks) && items[source].Stage != string(domain.Completed) {
			items[target].Blocked = true
		}
	}
	return visible
}

func relationToDTO(relation *domain.Relation) RelationDTO {
	return RelationDTO{ID: relation.ID().String(), ProjectID: relation.ProjectID().String(),
		SourceID: relation.SourceID().String(), TargetID: relation.TargetID().String(),
		Type: string(relation.Type()), CreatedAt: relation.CreatedAt().UTC().Format(time.RFC3339)}
}

func toBlockedDTO(ctx context.Context, repo domain.Repository, item *domain.Item) (ItemDTO, error) {
	blocked, err := repo.IsBlocked(ctx, item.ProjectID(), item.ID())
	if err != nil {
		return ItemDTO{}, err
	}
	dto := toDTO(item)
	dto.Blocked = blocked
	return dto, nil
}
