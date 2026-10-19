package roadmap

import (
	"context"
	"errors"
	"maps"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/permission"
	domainproject "blog-api/internal/domain/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

type memoryRelationRepository struct {
	items     *memoryRepository
	relations map[shared.ID]*domain.Relation
	writeErr  error
}

func (r *memoryRelationRepository) WithinProject(_ context.Context, projectID shared.ID, fn func(domain.RelationRepository) error) error {
	r.items.mu.Lock()
	defer r.items.mu.Unlock()
	if !projectID.Equal(r.items.project) {
		return domainproject.ErrNotFound
	}
	before := maps.Clone(r.relations)
	if err := fn(r); err != nil {
		r.relations = before
		return err
	}
	return nil
}

func (r *memoryRelationRepository) FindItem(ctx context.Context, id shared.ID, includeDeleted bool) (*domain.Item, error) {
	return r.items.FindByID(ctx, id, includeDeleted)
}

func (r *memoryRelationRepository) FindByID(_ context.Context, projectID, id shared.ID) (*domain.Relation, error) {
	relation, exists := r.relations[id]
	if !exists || !relation.ProjectID().Equal(projectID) {
		return nil, domain.ErrRelationNotFound
	}
	return copyRelation(relation), nil
}

func (r *memoryRelationRepository) FindByProject(_ context.Context, projectID shared.ID, includeHidden bool) ([]*domain.Relation, error) {
	result := make([]*domain.Relation, 0)
	for _, relation := range r.relations {
		if !relation.ProjectID().Equal(projectID) {
			continue
		}
		if !includeHidden && (r.items.items[relation.SourceID()].DeletedAt() != nil || r.items.items[relation.TargetID()].DeletedAt() != nil) {
			continue
		}
		result = append(result, copyRelation(relation))
	}
	return result, nil
}

func (r *memoryRelationRepository) Create(_ context.Context, relation *domain.Relation) error {
	if r.writeErr != nil {
		return r.writeErr
	}
	r.relations[relation.ID()] = copyRelation(relation)
	return nil
}

func (r *memoryRelationRepository) Delete(_ context.Context, projectID, id shared.ID) error {
	if r.writeErr != nil {
		return r.writeErr
	}
	if _, err := r.FindByID(context.Background(), projectID, id); err != nil {
		return err
	}
	delete(r.relations, id)
	return nil
}

func copyRelation(r *domain.Relation) *domain.Relation {
	return domain.ReconstructRelation(r.ID(), r.ProjectID(), r.SourceID(), r.TargetID(), r.Type(), r.CreatedAt())
}

func relationServiceFixture(t *testing.T) (*RelationService, *memoryRelationRepository, *recordingBus, context.Context, []ItemDTO) {
	t.Helper()
	core, items, bus, ctx := testService(t)
	created := make([]ItemDTO, 0, 3)
	for _, title := range []string{"A", "B", "C"} {
		item, err := core.Create(ctx, items.project.String(), CreateInput{Title: title})
		require.NoError(t, err)
		created = append(created, item)
	}
	bus.events = nil
	repo := &memoryRelationRepository{items: items, relations: make(map[shared.ID]*domain.Relation)}
	return NewRelationService(repo, core.checker, bus), repo, bus, ctx, created
}

func TestRelationServiceRejectsSameTypeCyclesAndDuplicates(t *testing.T) {
	for _, kind := range []string{"extends", "fixes", "blocks"} {
		t.Run(kind, func(t *testing.T) {
			svc, repo, bus, ctx, items := relationServiceFixture(t)
			create := func(source, target, relationType string) error {
				_, err := svc.Create(ctx, repo.items.project.String(), CreateRelationInput{SourceID: source, TargetID: target, Type: relationType})
				return err
			}
			require.NoError(t, create(items[0].ID, items[1].ID, kind))
			require.NoError(t, create(items[1].ID, items[2].ID, kind))
			assert.True(t, shared.IsDomainError(create(items[0].ID, items[1].ID, kind), shared.CodeConflict))
			assert.True(t, shared.IsDomainError(create(items[1].ID, items[0].ID, kind), shared.CodeBadRequest))
			assert.True(t, shared.IsDomainError(create(items[2].ID, items[0].ID, kind), shared.CodeBadRequest))
			assert.Len(t, repo.relations, 2)
			assert.Len(t, bus.events, 2)
		})
	}
}

func TestRelationServiceAllowsOppositeDirectionsAcrossTypes(t *testing.T) {
	svc, repo, _, ctx, items := relationServiceFixture(t)
	for _, input := range []CreateRelationInput{
		{SourceID: items[0].ID, TargetID: items[1].ID, Type: "blocks"},
		{SourceID: items[1].ID, TargetID: items[0].ID, Type: "extends"},
		{SourceID: items[0].ID, TargetID: items[1].ID, Type: "fixes"},
	} {
		_, err := svc.Create(ctx, repo.items.project.String(), input)
		require.NoError(t, err)
	}
	assert.Len(t, repo.relations, 3)
}

func TestRelationServiceRejectsInvalidEndpointsAndType(t *testing.T) {
	svc, repo, bus, ctx, items := relationServiceFixture(t)
	other, err := domain.NewItem(shared.NewID(), shared.NewID(), 1, domain.Content{Title: "Other project"}, domain.Planned, "U", time.Now())
	require.NoError(t, err)
	repo.items.items[other.ID()] = other
	for _, input := range []CreateRelationInput{
		{SourceID: items[0].ID, TargetID: items[0].ID, Type: "blocks"},
		{SourceID: items[0].ID, TargetID: items[1].ID, Type: "related"},
		{SourceID: items[0].ID, TargetID: other.ID().String(), Type: "blocks"},
		{SourceID: other.ID().String(), TargetID: items[0].ID, Type: "blocks"},
		{SourceID: items[0].ID, TargetID: shared.NewID().String(), Type: "blocks"},
	} {
		_, err := svc.Create(ctx, repo.items.project.String(), input)
		require.Error(t, err)
	}
	assert.Empty(t, repo.relations)
	assert.Empty(t, bus.events)
}

func TestRelationServiceIncludesHiddenEdgesInCycleDetection(t *testing.T) {
	svc, repo, _, ctx, items := relationServiceFixture(t)
	for _, pair := range [][2]int{{0, 1}, {1, 2}} {
		_, err := svc.Create(ctx, repo.items.project.String(), CreateRelationInput{SourceID: items[pair[0]].ID, TargetID: items[pair[1]].ID, Type: "blocks"})
		require.NoError(t, err)
	}
	middleID := shared.MustParseID(items[1].ID)
	middle := repo.items.items[middleID]
	now := time.Now()
	repo.items.items[middleID] = domain.ReconstructItem(domain.ItemState{ID: middle.ID(), ProjectID: middle.ProjectID(), Number: middle.Number(),
		Content: domain.Content{Title: middle.Title()}, Stage: middle.Stage(), Position: middle.Position(), DeletedAt: &now})
	visible, err := svc.List(context.Background(), repo.items.project.String())
	require.NoError(t, err)
	assert.Empty(t, visible)
	_, err = svc.Create(ctx, repo.items.project.String(), CreateRelationInput{SourceID: items[2].ID, TargetID: items[0].ID, Type: "blocks"})
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest), "恢复隐藏条目后也不能出现环")
	_, err = svc.Create(ctx, repo.items.project.String(), CreateRelationInput{SourceID: items[0].ID, TargetID: items[1].ID, Type: "fixes"})
	assert.ErrorIs(t, err, domain.ErrNotFound)
}

func TestRelationServiceChecksPermissionsAndPublishesCommittedChanges(t *testing.T) {
	svc, repo, bus, ctx, items := relationServiceFixture(t)
	input := CreateRelationInput{SourceID: items[0].ID, TargetID: items[1].ID, Type: "blocks"}
	checker := &testChecker{}
	svc.checker = checker
	_, err := svc.Create(ctx, repo.items.project.String(), input)
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	err = svc.Delete(ctx, repo.items.project.String(), shared.NewID().String())
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	assert.Equal(t, []string{permission.ProjectUpdate.String(), permission.ProjectUpdate.String()}, checker.codes)
	_, err = svc.Create(context.Background(), repo.items.project.String(), input)
	assert.True(t, shared.IsDomainError(err, shared.CodeUnauthorized))
	err = svc.Delete(context.Background(), repo.items.project.String(), shared.NewID().String())
	assert.True(t, shared.IsDomainError(err, shared.CodeUnauthorized))
	checker.allowed = true
	repo.writeErr = errors.New("database unavailable")
	_, err = svc.Create(ctx, repo.items.project.String(), input)
	assert.ErrorIs(t, err, repo.writeErr)
	assert.Empty(t, repo.relations)
	assert.Empty(t, bus.events)
	repo.writeErr = nil
	relation, err := svc.Create(ctx, repo.items.project.String(), input)
	require.NoError(t, err)
	require.Len(t, bus.events, 1)
	assert.Equal(t, "roadmap.relation.created", bus.events[0].EventName())
	repo.writeErr = errors.New("delete unavailable")
	err = svc.Delete(ctx, repo.items.project.String(), relation.ID)
	assert.ErrorIs(t, err, repo.writeErr)
	assert.Len(t, repo.relations, 1)
	assert.Len(t, bus.events, 1)
	repo.writeErr = nil
	err = svc.Delete(ctx, repo.items.project.String(), relation.ID)
	require.NoError(t, err)
	assert.Empty(t, repo.relations)
	require.Len(t, bus.events, 2)
	assert.Equal(t, "roadmap.relation.deleted", bus.events[1].EventName())
}

func TestBlockedIsDerivedOnlyFromVisibleUnfinishedBlocks(t *testing.T) {
	items := []ItemDTO{{ID: "a", Stage: "planned"}, {ID: "b", Stage: "in_progress"}, {ID: "c", Stage: "completed"}}
	relations := []RelationDTO{{SourceID: "a", TargetID: "b", Type: "blocks"}, {SourceID: "c", TargetID: "b", Type: "blocks"},
		{SourceID: "a", TargetID: "c", Type: "extends"}, {SourceID: "deleted", TargetID: "a", Type: "blocks"}}
	EnrichRelations(items, relations)
	assert.False(t, items[0].Blocked)
	assert.True(t, items[1].Blocked)
	assert.False(t, items[2].Blocked)
	assert.Equal(t, "in_progress", items[1].Stage)
	items[0].Stage = "completed"
	EnrichRelations(items, relations)
	assert.False(t, items[1].Blocked, "所有前置完成后自动解除")
	items[0].Stage = "planned"
	EnrichRelations(items[1:], relations)
	assert.False(t, items[1].Blocked, "已删除前置不参与派生")
}
