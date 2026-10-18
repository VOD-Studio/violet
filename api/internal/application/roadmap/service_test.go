package roadmap

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	appshared "blog-api/internal/application/shared"
	"blog-api/internal/domain/permission"
	domainproject "blog-api/internal/domain/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memoryRepository struct {
	mu      sync.Mutex
	project shared.ID
	items   map[shared.ID]*domain.Item
	numbers map[shared.ID]int64
	saveErr error
	listErr error
	saveIDs []shared.ID
}

func (r *memoryRepository) WithinProject(ctx context.Context, id shared.ID, fn func(domain.Repository) error) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.project.Equal(id) {
		return domainproject.ErrNotFound
	}
	items := make(map[shared.ID]*domain.Item, len(r.items))
	for id, item := range r.items {
		items[id] = copyItem(item)
	}
	number := r.numbers[id]
	if err := fn(r); err != nil {
		r.items = items
		r.numbers[id] = number
		return err
	}
	return nil
}

func (r *memoryRepository) FindByID(_ context.Context, id shared.ID, includeDeleted bool) (*domain.Item, error) {
	item, ok := r.items[id]
	if !ok || !includeDeleted && item.DeletedAt() != nil {
		return nil, domain.ErrNotFound
	}
	return copyItem(item), nil
}

func (r *memoryRepository) FindByProject(_ context.Context, id shared.ID) ([]*domain.Item, error) {
	if r.listErr != nil {
		return nil, r.listErr
	}
	items := make([]*domain.Item, 0)
	for _, item := range r.items {
		if item.ProjectID().Equal(id) && item.DeletedAt() == nil {
			items = append(items, copyItem(item))
		}
	}
	slices.SortFunc(items, func(a, b *domain.Item) int {
		if a.Position() < b.Position() {
			return -1
		}
		if a.Position() > b.Position() {
			return 1
		}
		return 0
	})
	return items, nil
}

func (r *memoryRepository) NextNumber(_ context.Context, id shared.ID) (int64, error) {
	r.numbers[id]++
	return r.numbers[id], nil
}

func (r *memoryRepository) Save(_ context.Context, item *domain.Item) error {
	if r.saveErr != nil {
		return r.saveErr
	}
	r.items[item.ID()] = copyItem(item)
	r.saveIDs = append(r.saveIDs, item.ID())
	return nil
}

func copyItem(item *domain.Item) *domain.Item {
	return domain.ReconstructItem(domain.ItemState{ID: item.ID(), ProjectID: item.ProjectID(), Number: item.Number(),
		Content: domain.Content{Title: item.Title(), Description: item.Description(), Tags: item.Tags(), Links: item.Links(),
			CompletionDate: item.CompletionDate(), DeliveredVersion: item.DeliveredVersion()},
		Stage: item.Stage(), Position: item.Position(), DeletedAt: item.DeletedAt(), CreatedAt: item.CreatedAt(), UpdatedAt: item.UpdatedAt()})
}

type projectRepository struct {
	domainproject.ProjectRepository
	project *domainproject.Project
}

func (r projectRepository) FindBySlug(_ context.Context, slug string) (*domainproject.Project, error) {
	if slug == r.project.Slug() {
		return r.project, nil
	}
	return nil, domainproject.ErrNotFound
}

type testChecker struct {
	allowed bool
	codes   []string
}

func (c *testChecker) HasPermission(_ string, isRoot bool, codes ...string) bool {
	c.codes = append(c.codes, codes...)
	return c.allowed || isRoot
}

type recordingBus struct {
	appshared.NoopEventBus
	events []shared.DomainEvent
}

func (b *recordingBus) Publish(_ context.Context, events []shared.DomainEvent) error {
	b.events = append(b.events, events...)
	return nil
}

func testService(t *testing.T) (*Service, *memoryRepository, *recordingBus, context.Context) {
	t.Helper()
	project, err := domainproject.NewProject(shared.NewID(), "Roadmap", "Project")
	require.NoError(t, err)
	repo := &memoryRepository{project: project.ID(), items: map[shared.ID]*domain.Item{}, numbers: map[shared.ID]int64{}}
	bus := &recordingBus{}
	svc := NewService(repo, projectRepository{project: project}, &testChecker{allowed: true}, bus)
	svc.now = func() time.Time { return time.Date(2026, 10, 18, 16, 30, 0, 0, time.UTC) }
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, shared.NewID().String())
	ctx = context.WithValue(ctx, middleware.UserRoleKey, "admin")
	return svc, repo, bus, ctx
}

func TestServiceCreatePersistsStableNumbersAndContent(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	first, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "First", Description: "Plain text",
		Tags: []string{"backend"}, Links: []LinkDTO{{Label: "Issue", URL: "/projects/roadmap"}}})
	require.NoError(t, err)
	second, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Second"})
	require.NoError(t, err)
	assert.Equal(t, int64(1), first.Number)
	assert.Equal(t, int64(2), second.Number)
	assert.Less(t, first.Position, second.Position)
	assert.Equal(t, "planned", first.Stage)
	assert.Nil(t, first.CompletionDate)
	assert.Equal(t, []LinkDTO{{Label: "Issue", URL: "/projects/roadmap"}}, first.Links)
	assert.Empty(t, second.Tags)
	assert.NotNil(t, second.Tags)
	assert.NotNil(t, second.Links)
	require.Len(t, bus.events, 2)
	assert.Equal(t, "roadmap.item.created", bus.events[0].EventName())
}

func TestServiceDateRulesAndContentEditing(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	done, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Done", Stage: "completed", DeliveredVersion: "v1"})
	require.NoError(t, err)
	require.NotNil(t, done.CompletionDate)
	assert.Equal(t, "2026-10-19", *done.CompletionDate, "日历日期应使用上海时区")
	date := "2026-10-12"
	updated, err := svc.Update(ctx, repo.project.String(), done.ID, UpdateInput{Title: "Updated", CompletionDate: &date})
	require.NoError(t, err)
	assert.Equal(t, date, *updated.CompletionDate)
	assert.Empty(t, updated.DeliveredVersion)
	assert.Equal(t, done.Number, updated.Number)
	assert.Equal(t, done.Position, updated.Position)
	updated, err = svc.Update(ctx, repo.project.String(), done.ID, UpdateInput{Title: "Updated"})
	require.NoError(t, err)
	assert.Equal(t, date, *updated.CompletionDate)
	assert.Len(t, bus.events, 2, "无实际变更不产生审计事件")
	badDate := "2026-02-30"
	_, err = svc.Update(ctx, repo.project.String(), done.ID, UpdateInput{Title: "Updated", CompletionDate: &badDate})
	require.Error(t, err)
	_, err = svc.Create(ctx, repo.project.String(), CreateInput{Title: "Planned", DeliveredVersion: "v1"})
	require.Error(t, err)
}

func TestServiceRequiresProjectUpdateForEveryWrite(t *testing.T) {
	svc, repo, _, ctx := testService(t)
	checker := &testChecker{}
	svc.checker = checker
	_, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Denied"})
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	_, err = svc.Update(ctx, repo.project.String(), shared.NewID().String(), UpdateInput{Title: "Denied"})
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	assert.Equal(t, []string{permission.ProjectUpdate.String(), permission.ProjectUpdate.String()}, checker.codes)
	_, err = svc.Create(context.Background(), repo.project.String(), CreateInput{Title: "Anonymous"})
	assert.True(t, shared.IsDomainError(err, shared.CodeUnauthorized))
	assert.Empty(t, repo.items)
}

func TestServiceDoesNotPublishRolledBackWrites(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	repo.saveErr = errors.New("database unavailable")
	_, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Not saved"})
	require.Error(t, err)
	assert.Empty(t, bus.events)
	assert.Empty(t, repo.items)
	repo.saveErr = nil
	saved, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Saved"})
	require.NoError(t, err)
	assert.Equal(t, int64(1), saved.Number)
}

func TestServicePublicDetailProgressAndErrors(t *testing.T) {
	svc, repo, _, ctx := testService(t)
	for n, stage := range []string{"planned", "in_progress", "completed", "completed", "completed", "planned"} {
		_, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: fmt.Sprintf("Item %d", n), Stage: stage})
		require.NoError(t, err)
	}
	slug := svc.projects.(projectRepository).project.Slug()
	detail, err := svc.GetBySlug(context.Background(), slug)
	require.NoError(t, err)
	assert.Len(t, detail.Items, 6)
	assert.Equal(t, ProgressDTO{Planned: 2, InProgress: 1, Completed: 3, Total: 6, Percent: 50}, detail.Progress)
	assert.Equal(t, repo.project.String(), detail.Project.ID)
	_, err = svc.GetBySlug(context.Background(), "missing")
	assert.ErrorIs(t, err, domainproject.ErrNotFound)
	repo.listErr = errors.New("query unavailable")
	_, err = svc.GetBySlug(context.Background(), slug)
	assert.ErrorIs(t, err, repo.listErr)
}

func TestProgressRoundsToNearestInteger(t *testing.T) {
	svc, repo, _, ctx := testService(t)
	for _, stage := range []string{"completed", "planned", "in_progress"} {
		_, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: stage, Stage: stage})
		require.NoError(t, err)
	}
	items, err := repo.FindByProject(ctx, repo.project)
	require.NoError(t, err)
	assert.Equal(t, 33, progressOf(items).Percent)
	assert.Equal(t, ProgressDTO{}, progressOf(nil))
}

func TestServiceRejectsCrossProjectEdit(t *testing.T) {
	svc, repo, _, ctx := testService(t)
	other, err := domain.NewItem(shared.NewID(), shared.NewID(), 1, domain.Content{Title: "Other"}, domain.Planned, "V", svc.now())
	require.NoError(t, err)
	repo.items[other.ID()] = other
	_, err = svc.Update(ctx, repo.project.String(), other.ID().String(), UpdateInput{Title: "Changed"})
	assert.ErrorIs(t, err, domain.ErrNotFound)
	assert.Equal(t, "Other", repo.items[other.ID()].Title())
}
