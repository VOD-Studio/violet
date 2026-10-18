package roadmap

import (
	"context"
	"time"

	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/rs/zerolog/log"
)

type RelationService struct {
	repo    domain.RelationRepository
	checker PermissionChecker
	bus     appshared.EventBus
}

func NewRelationService(repo domain.RelationRepository, checker PermissionChecker, bus appshared.EventBus) *RelationService {
	return &RelationService{repo: repo, checker: checker, bus: bus}
}

// List 公开读取两端均未软删除的关系；项目是否存在由项目详情用例检查。
func (s *RelationService) List(ctx context.Context, projectID string) ([]RelationDTO, error) {
	pid, err := parseID(projectID)
	if err != nil {
		return nil, err
	}
	relations, err := s.repo.FindByProject(ctx, pid, false)
	if err != nil {
		return nil, err
	}
	dtos := make([]RelationDTO, 0, len(relations))
	for _, relation := range relations {
		dtos = append(dtos, relationToDTO(relation))
	}
	return dtos, nil
}

func (s *RelationService) Create(ctx context.Context, projectID string, input CreateRelationInput) (RelationDTO, error) {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return RelationDTO{}, err
	}
	pid, sourceID, err := parseIDs(projectID, input.SourceID)
	if err != nil {
		return RelationDTO{}, err
	}
	targetID, err := parseID(input.TargetID)
	if err != nil {
		return RelationDTO{}, err
	}
	relation, err := domain.NewRelation(shared.NewID(), pid, sourceID, targetID, domain.RelationType(input.Type), time.Now())
	if err != nil {
		return RelationDTO{}, err
	}
	err = s.repo.WithinProject(ctx, pid, func(repo domain.RelationRepository) error {
		for _, id := range []shared.ID{sourceID, targetID} {
			item, findErr := repo.FindItem(ctx, id, false)
			if findErr != nil {
				return findErr
			}
			if !item.ProjectID().Equal(pid) {
				return shared.BadRequest("条目关系不能跨项目建立")
			}
		}
		existing, findErr := repo.FindByProject(ctx, pid, true)
		if findErr != nil {
			return findErr
		}
		if err := domain.ValidateRelationGraph(relation, existing); err != nil {
			return err
		}
		return repo.Create(ctx, relation)
	})
	if err != nil {
		return RelationDTO{}, err
	}
	s.publishEvents(ctx, relation)
	return relationToDTO(relation), nil
}

// Delete 显式移除关系；之后恢复任一条目都不会重建该关系。
func (s *RelationService) Delete(ctx context.Context, projectID, relationID string) error {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return err
	}
	pid, id, err := parseIDs(projectID, relationID)
	if err != nil {
		return err
	}
	var relation *domain.Relation
	err = s.repo.WithinProject(ctx, pid, func(repo domain.RelationRepository) error {
		var findErr error
		relation, findErr = repo.FindByID(ctx, pid, id)
		if findErr != nil {
			return findErr
		}
		if err := repo.Delete(ctx, pid, id); err != nil {
			return err
		}
		relation.MarkDeleted()
		return nil
	})
	if err != nil {
		return err
	}
	s.publishEvents(ctx, relation)
	return nil
}

func (s *RelationService) publishEvents(ctx context.Context, relation *domain.Relation) {
	events := relation.PullEvents()
	if s.bus != nil && len(events) > 0 {
		if err := s.bus.Publish(ctx, events); err != nil {
			log.Warn().Err(err).Msg("发布路线图关系事件失败")
		}
	}
}

var _ RelationReader = (*RelationService)(nil)
