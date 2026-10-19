package roadmap

import (
	"context"

	domain "blog-api/internal/domain/roadmap"
)

func (s *Service) Delete(ctx context.Context, projectID, itemID string) error {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return err
	}
	pid, id, err := parseIDs(projectID, itemID)
	if err != nil {
		return err
	}
	var item *domain.Item
	err = s.repo.WithinProject(ctx, pid, func(repo domain.Repository) error {
		var err error
		item, err = findProjectItem(ctx, repo, pid, id, true)
		if err != nil {
			return err
		}
		item.SoftDelete(s.now())
		if !item.HasEvents() {
			return nil
		}
		return repo.Save(ctx, item)
	})
	if err != nil {
		return err
	}
	s.publishEvents(ctx, item)
	return nil
}

func (s *Service) Restore(ctx context.Context, projectID, itemID string) (ItemDTO, error) {
	if err := requireProjectUpdate(ctx, s.checker); err != nil {
		return ItemDTO{}, err
	}
	pid, id, err := parseIDs(projectID, itemID)
	if err != nil {
		return ItemDTO{}, err
	}
	var item *domain.Item
	var dto ItemDTO
	err = s.repo.WithinProject(ctx, pid, func(repo domain.Repository) error {
		var err error
		item, err = findProjectItem(ctx, repo, pid, id, true)
		if err != nil {
			return err
		}
		item.Restore(s.now())
		if item.HasEvents() {
			if err := repo.Save(ctx, item); err != nil {
				return err
			}
		}
		dto, err = toBlockedDTO(ctx, repo, item)
		return err
	})
	if err != nil {
		return ItemDTO{}, err
	}
	s.publishEvents(ctx, item)
	return dto, nil
}
