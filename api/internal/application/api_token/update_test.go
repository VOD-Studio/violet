package apitoken

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appshared "blog-api/internal/application/shared"
	domainapitoken "blog-api/internal/domain/api_token"
	"blog-api/internal/domain/shared"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
)

func updateFixture() *domainapitoken.PAT {
	created := time.Date(2020, 1, 1, 0, 0, 0, 123456789, time.UTC)
	return domainapitoken.Reconstruct("00000000-0000-0000-0000-000000000001", "owner", "原名", "secret-hash",
		[]string{domainapitoken.ScopePostsRead}, created.Add(time.Hour), created.Add(time.Minute), created, true)
}

func TestServiceUpdate_PreservesExpiredTokenAndEmitsSafeDiff(t *testing.T) {
	ctx := context.Background()
	original := updateFixture()
	repo := &fakeRepo{findByUser: []*domainapitoken.PAT{original}}
	bus := infraeventbus.NewInMemory()
	var events []domainapitoken.PATUpdated
	bus.Subscribe("api_token.updated", func(_ context.Context, event shared.DomainEvent) error {
		events = append(events, event.(domainapitoken.PATUpdated))
		return nil
	})
	svc := NewService(repo, bus)
	name, interactive := "  新名  ", false
	got, err := svc.Update(ctx, UpdateInput{ID: original.ID(), UserID: original.UserID(), Name: &name, Interactive: &interactive})
	require.NoError(t, err)
	assert.Equal(t, "新名", got.Name)
	assert.Equal(t, original.ExpiresAt().Format(time.RFC3339), got.ExpiresAt)
	require.NotNil(t, got.Interactive)
	assert.False(t, *got.Interactive)
	assert.Empty(t, got.PlaintextToken)
	stored := repo.findByUser[0]
	assert.Equal(t, original.TokenHash(), stored.TokenHash())
	assert.Equal(t, original.ID(), stored.ID())
	assert.Equal(t, original.UserID(), stored.UserID())
	assert.Equal(t, original.CreatedAt(), stored.CreatedAt())
	assert.Equal(t, original.LastUsedAt(), stored.LastUsedAt())
	assert.Equal(t, original.ExpiresAt(), stored.ExpiresAt())
	require.Len(t, events, 1)
	assert.Equal(t, original.ID(), events[0].AggregateID().String())
	assert.Equal(t, []domainapitoken.PATChange{
		{Field: "name", From: "原名", To: "新名"},
		{Field: "interactive", From: true, To: false},
	}, events[0].Changes)
	encoded, err := json.Marshal(events[0])
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), original.TokenHash())
	assert.NotContains(t, string(encoded), "token_hash")

	_, err = svc.Update(ctx, UpdateInput{ID: original.ID(), UserID: original.UserID(), Name: &name, Interactive: &interactive})
	require.NoError(t, err)
	assert.Len(t, events, 1, "无实际差异不重复审计")
}

func TestServiceUpdate_RejectsMissingAndForeignToken(t *testing.T) {
	original := updateFixture()
	for _, in := range []UpdateInput{
		{ID: original.ID(), UserID: "other"},
		{ID: "missing", UserID: original.UserID()},
	} {
		repo := &fakeRepo{findByUser: []*domainapitoken.PAT{original}}
		_, err := NewService(repo, infraeventbus.NewInMemory()).Update(context.Background(), in)
		assert.ErrorIs(t, err, domainapitoken.ErrNotFound)
		assert.Equal(t, original, repo.findByUser[0])
	}
}

func TestServiceUpdate_FailedWritesLeaveTokenAndAuditUnchanged(t *testing.T) {
	for _, writeErr := range []error{errors.New("database unavailable"), domainapitoken.ErrNotFound} {
		t.Run(writeErr.Error(), func(t *testing.T) {
			original := updateFixture()
			repo := &fakeRepo{findByUser: []*domainapitoken.PAT{original}, updateErr: writeErr}
			bus := infraeventbus.NewInMemory()
			var events []shared.DomainEvent
			bus.Subscribe("api_token.updated", func(_ context.Context, e shared.DomainEvent) error {
				events = append(events, e)
				return nil
			})
			name := "不应保存"
			_, err := NewService(repo, bus).Update(context.Background(), UpdateInput{ID: original.ID(), UserID: original.UserID(), Name: &name})
			assert.ErrorIs(t, err, writeErr)
			assert.Equal(t, original, repo.findByUser[0])
			assert.Equal(t, "原名", repo.findByUser[0].Name())
			assert.Empty(t, events)
		})
	}
}

type failingUpdateBus struct {
	appshared.NoopEventBus
}

func (failingUpdateBus) Publish(context.Context, []shared.DomainEvent) error {
	return errors.New("audit unavailable")
}

func TestServiceUpdate_PublishFailureDoesNotUndoSuccessfulEdit(t *testing.T) {
	original := updateFixture()
	repo := &fakeRepo{findByUser: []*domainapitoken.PAT{original}}
	name := "已保存"
	got, err := NewService(repo, failingUpdateBus{}).Update(context.Background(), UpdateInput{ID: original.ID(), UserID: original.UserID(), Name: &name})
	require.NoError(t, err)
	assert.Equal(t, name, got.Name)
	assert.Equal(t, name, repo.findByUser[0].Name())
}
