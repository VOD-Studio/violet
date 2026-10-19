package roadmap

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

func (r *memoryRepository) IsBlocked(context.Context, shared.ID, shared.ID) (bool, error) {
	return false, nil
}

type blockedResponseRepository struct {
	*memoryRepository
	blockedID shared.ID
	readErr   error
}

func (r *blockedResponseRepository) WithinProject(ctx context.Context, id shared.ID, fn func(domain.Repository) error) error {
	return r.memoryRepository.WithinProject(ctx, id, func(domain.Repository) error { return fn(r) })
}

func (r *blockedResponseRepository) IsBlocked(_ context.Context, projectID, itemID shared.ID) (bool, error) {
	return projectID.Equal(r.project) && itemID.Equal(r.blockedID), r.readErr
}

func TestItemWriteResponsesKeepCurrentBlockedStatus(t *testing.T) {
	for _, test := range []struct {
		name       string
		deleteItem bool
		changed    bool
		command    func(*Service, context.Context, string, string) (ItemDTO, error)
	}{
		{name: "update", changed: true, command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Update(ctx, pid, id, UpdateInput{Title: "Changed"})
		}},
		{name: "unchanged update", command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Update(ctx, pid, id, UpdateInput{Title: "Item"})
		}},
		{name: "move", changed: true, command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Move(ctx, pid, id, MoveInput{Stage: "in_progress"})
		}},
		{name: "unchanged move", command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Move(ctx, pid, id, MoveInput{Stage: "planned"})
		}},
		{name: "restore", deleteItem: true, changed: true, command: (*Service).Restore},
		{name: "unchanged restore", command: (*Service).Restore},
	} {
		t.Run(test.name, func(t *testing.T) {
			service, repo, bus, ctx := testService(t)
			item, err := service.Create(ctx, repo.project.String(), CreateInput{Title: "Item"})
			require.NoError(t, err)
			assert.False(t, item.Blocked)
			if test.deleteItem {
				require.NoError(t, service.Delete(ctx, repo.project.String(), item.ID))
			}
			bus.events = nil
			service.repo = &blockedResponseRepository{memoryRepository: repo, blockedID: shared.MustParseID(item.ID)}
			response, err := test.command(service, ctx, repo.project.String(), item.ID)
			require.NoError(t, err)
			assert.True(t, response.Blocked)
			if test.changed {
				assert.Len(t, bus.events, 1)
			} else {
				assert.Empty(t, bus.events)
			}
		})
	}
}

func TestBlockedReadFailureRollsBackItemCommands(t *testing.T) {
	for _, test := range []struct {
		name       string
		deleteItem bool
		command    func(*Service, context.Context, string, string) (ItemDTO, error)
	}{
		{name: "update", command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Update(ctx, pid, id, UpdateInput{Title: "Changed"})
		}},
		{name: "move", command: func(s *Service, ctx context.Context, pid, id string) (ItemDTO, error) {
			return s.Move(ctx, pid, id, MoveInput{Stage: "in_progress"})
		}},
		{name: "restore", deleteItem: true, command: (*Service).Restore},
	} {
		t.Run(test.name, func(t *testing.T) {
			service, repo, bus, ctx := testService(t)
			item, err := service.Create(ctx, repo.project.String(), CreateInput{Title: "Item"})
			require.NoError(t, err)
			if test.deleteItem {
				require.NoError(t, service.Delete(ctx, repo.project.String(), item.ID))
			}
			bus.events = nil
			id := shared.MustParseID(item.ID)
			before := copyItem(repo.items[id])
			readErr := errors.New("blocked query unavailable")
			service.repo = &blockedResponseRepository{memoryRepository: repo, blockedID: id, readErr: readErr}
			_, err = test.command(service, ctx, repo.project.String(), item.ID)
			assert.ErrorIs(t, err, readErr)
			assert.Equal(t, toDTO(before), toDTO(repo.items[id]))
			assert.Equal(t, before.DeletedAt(), repo.items[id].DeletedAt())
			assert.Empty(t, bus.events)
		})
	}
}

type failedRelationReader struct{ err error }

func (r failedRelationReader) List(context.Context, string) ([]RelationDTO, error) {
	return nil, r.err
}

func TestPublicDetailContainsRelationsAndDerivedBlocked(t *testing.T) {
	base, items, bus, ctx := testService(t)
	repo := &memoryRelationRepository{items: items, relations: make(map[shared.ID]*domain.Relation)}
	relations := NewRelationService(repo, base.checker, bus)
	service := NewService(base.repo, base.projects, base.checker, bus, WithRelations(relations))
	a, err := service.Create(ctx, items.project.String(), CreateInput{Title: "Prerequisite"})
	require.NoError(t, err)
	b, err := service.Create(ctx, items.project.String(), CreateInput{Title: "Target"})
	require.NoError(t, err)
	edge, err := relations.Create(ctx, items.project.String(), CreateRelationInput{SourceID: a.ID, TargetID: b.ID, Type: "blocks"})
	require.NoError(t, err)
	slug := base.projects.(projectRepository).project.Slug()
	checkDetail := func(blocked bool, relationCount int) {
		t.Helper()
		detail, err := service.GetBySlug(context.Background(), slug)
		require.NoError(t, err)
		assert.Len(t, detail.Relations, relationCount)
		for _, item := range detail.Items {
			if item.ID == b.ID {
				assert.Equal(t, blocked, item.Blocked)
			}
		}
		if relationCount > 0 {
			assert.Equal(t, edge.ID, detail.Relations[0].ID)
		}
	}
	checkDetail(true, 1)
	require.NoError(t, service.Delete(ctx, items.project.String(), a.ID))
	checkDetail(false, 0)
	_, err = service.Restore(ctx, items.project.String(), a.ID)
	require.NoError(t, err)
	checkDetail(true, 1)
	_, err = service.Move(ctx, items.project.String(), a.ID, MoveInput{Stage: "completed"})
	require.NoError(t, err)
	checkDetail(false, 1)
	service.relations = failedRelationReader{err: errors.New("relations unavailable")}
	_, err = service.GetBySlug(context.Background(), slug)
	assert.EqualError(t, err, "relations unavailable")
}
