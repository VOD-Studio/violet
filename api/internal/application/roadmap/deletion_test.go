package roadmap

import (
	"context"
	"errors"
	"testing"
	"time"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceSoftDeleteAndRestorePreserveContentAndNumber(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	original, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Original", Description: "Description",
		Stage: "completed", Tags: []string{"API"}, Links: []LinkDTO{{Label: "PR", URL: "/posts/pull-request"}}, DeliveredVersion: "v1"})
	require.NoError(t, err)
	bus.events = nil
	repo.saveIDs = nil
	svc.now = func() time.Time { return time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC) }
	require.NoError(t, svc.Delete(ctx, repo.project.String(), original.ID))
	stored := repo.items[shared.MustParseID(original.ID)]
	require.NotNil(t, stored.DeletedAt())
	slug := svc.projects.(projectRepository).project.Slug()
	detail, err := svc.GetBySlug(context.Background(), slug)
	require.NoError(t, err)
	assert.Empty(t, detail.Items)
	assert.Equal(t, ProgressDTO{}, detail.Progress)
	require.NoError(t, svc.Delete(ctx, repo.project.String(), original.ID))
	assert.Len(t, repo.saveIDs, 1, "重复删除不写库")
	require.Len(t, bus.events, 1)
	assert.Equal(t, "roadmap.item.deleted", bus.events[0].EventName())
	_, err = svc.Update(ctx, repo.project.String(), original.ID, UpdateInput{Title: "Changed"})
	assert.ErrorIs(t, err, domain.ErrNotFound)
	_, err = svc.Move(ctx, repo.project.String(), original.ID, MoveInput{Stage: "in_progress"})
	assert.ErrorIs(t, err, domain.ErrNotFound)
	newItem, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "New"})
	require.NoError(t, err)
	assert.Equal(t, original.Number+1, newItem.Number)
	bus.events = nil
	repo.saveIDs = nil
	restored, err := svc.Restore(ctx, repo.project.String(), original.ID)
	require.NoError(t, err)
	expected := original
	expected.UpdatedAt = restored.UpdatedAt
	assert.Equal(t, expected, restored, "仅更新时间与删除标记变化")
	assert.Nil(t, repo.items[shared.MustParseID(original.ID)].DeletedAt())
	detail, err = svc.GetBySlug(context.Background(), slug)
	require.NoError(t, err)
	assert.Len(t, detail.Items, 2)
	assert.Equal(t, 50, detail.Progress.Percent)
	repeated, err := svc.Restore(ctx, repo.project.String(), original.ID)
	require.NoError(t, err)
	assert.Equal(t, restored, repeated)
	assert.Len(t, repo.saveIDs, 1, "重复恢复不写库")
	require.Len(t, bus.events, 1)
	assert.Equal(t, "roadmap.item.restored", bus.events[0].EventName())
}

func TestServiceDeletionRejectsUnauthorizedMissingAndCrossProjectItems(t *testing.T) {
	svc, repo, _, ctx := testService(t)
	item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Owned"})
	require.NoError(t, err)
	svc.checker = &testChecker{}
	assert.True(t, shared.IsDomainError(svc.Delete(ctx, repo.project.String(), item.ID), shared.CodeForbidden))
	_, err = svc.Restore(ctx, repo.project.String(), item.ID)
	assert.True(t, shared.IsDomainError(err, shared.CodeForbidden))
	assert.True(t, shared.IsDomainError(svc.Delete(context.Background(), repo.project.String(), item.ID), shared.CodeUnauthorized))
	_, err = svc.Restore(context.Background(), repo.project.String(), item.ID)
	assert.True(t, shared.IsDomainError(err, shared.CodeUnauthorized))
	svc.checker = &testChecker{allowed: true}
	missing := shared.NewID().String()
	assert.ErrorIs(t, svc.Delete(ctx, repo.project.String(), missing), domain.ErrNotFound)
	_, err = svc.Restore(ctx, repo.project.String(), missing)
	assert.ErrorIs(t, err, domain.ErrNotFound)
	other, err := domain.NewItem(shared.NewID(), shared.NewID(), 1, domain.Content{Title: "Other"}, domain.Planned, "V", svc.now())
	require.NoError(t, err)
	repo.items[other.ID()] = other
	assert.ErrorIs(t, svc.Delete(ctx, repo.project.String(), other.ID().String()), domain.ErrNotFound)
	_, err = svc.Restore(ctx, repo.project.String(), other.ID().String())
	assert.ErrorIs(t, err, domain.ErrNotFound)
	assert.Nil(t, repo.items[other.ID()].DeletedAt())
}

func TestServiceDeletionDoesNotPublishFailedWrites(t *testing.T) {
	svc, repo, bus, ctx := testService(t)
	item, err := svc.Create(ctx, repo.project.String(), CreateInput{Title: "Item"})
	require.NoError(t, err)
	bus.events = nil
	repo.saveErr = errors.New("write unavailable")
	require.Error(t, svc.Delete(ctx, repo.project.String(), item.ID))
	assert.Empty(t, bus.events)
	assert.Nil(t, repo.items[shared.MustParseID(item.ID)].DeletedAt())
	repo.saveErr = nil
	require.NoError(t, svc.Delete(ctx, repo.project.String(), item.ID))
	bus.events = nil
	repo.saveErr = errors.New("write unavailable")
	_, err = svc.Restore(ctx, repo.project.String(), item.ID)
	require.Error(t, err)
	assert.Empty(t, bus.events)
	assert.NotNil(t, repo.items[shared.MustParseID(item.ID)].DeletedAt())
}
