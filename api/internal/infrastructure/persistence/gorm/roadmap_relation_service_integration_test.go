package gorm

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	approadmap "blog-api/internal/application/roadmap"
	appshared "blog-api/internal/application/shared"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type relationIntegrationChecker struct{}

func (relationIntegrationChecker) HasPermission(_ string, _ bool, codes ...string) bool {
	return len(codes) == 1 && codes[0] == "project:update"
}

func relationIntegrationContext() context.Context {
	return context.WithValue(context.Background(), middleware.UserIDKey, shared.NewID().String())
}

type relationReadGate struct {
	domain.RelationRepository
	state *relationReadGateState
}

type relationReadGateState struct {
	first      atomic.Bool
	firstRead  chan struct{}
	secondRead chan struct{}
	release    chan struct{}
}

func (r relationReadGate) WithinProject(ctx context.Context, id shared.ID, fn func(domain.RelationRepository) error) error {
	return r.RelationRepository.WithinProject(ctx, id, func(tx domain.RelationRepository) error {
		return fn(relationReadGate{RelationRepository: tx, state: r.state})
	})
}

func (r relationReadGate) FindByProject(ctx context.Context, id shared.ID, includeHidden bool) ([]*domain.Relation, error) {
	relations, err := r.RelationRepository.FindByProject(ctx, id, includeHidden)
	if err != nil || !includeHidden {
		return relations, err
	}
	if r.state.first.CompareAndSwap(false, true) {
		close(r.state.firstRead)
		select {
		case <-r.state.release:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	} else {
		select {
		case r.state.secondRead <- struct{}{}:
		default:
		}
	}
	return relations, nil
}

func TestRoadmapRelationConcurrentReverseEdgesCannotBothCommit(t *testing.T) {
	for _, kind := range []string{"extends", "fixes", "blocks"} {
		t.Run(kind, func(t *testing.T) {
			db := setupIntegrationDB(t)
			projectID := seedRelationProject(t, db)
			a, b := seedRelationItem(t, db, projectID, 1), seedRelationItem(t, db, projectID, 2)
			state := &relationReadGateState{firstRead: make(chan struct{}), secondRead: make(chan struct{}, 1), release: make(chan struct{})}
			release := sync.OnceFunc(func() { close(state.release) })
			defer release()
			repo := NewRoadmapRelationRepository(db)
			service := approadmap.NewRelationService(relationReadGate{RelationRepository: repo, state: state}, relationIntegrationChecker{}, appshared.NoopEventBus{})
			ctx, cancel := context.WithTimeout(relationIntegrationContext(), 10*time.Second)
			defer cancel()
			firstDone, secondDone := make(chan error, 1), make(chan error, 1)
			go func() {
				_, err := service.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: a.ID().String(), TargetID: b.ID().String(), Type: kind})
				firstDone <- err
			}()
			select {
			case <-state.firstRead:
			case <-ctx.Done():
				t.Fatal("首个关系请求未进入图校验")
			}
			go func() {
				_, err := service.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: b.ID().String(), TargetID: a.ID().String(), Type: kind})
				secondDone <- err
			}()
			// 首个请求已读完空图但尚未写入；另一请求须等待同一项目锁。
			secondReadBeforeCommit := false
			select {
			case <-state.secondRead:
				secondReadBeforeCommit = true
			case <-time.After(100 * time.Millisecond):
			}
			release()
			require.NoError(t, <-firstDone)
			err := <-secondDone
			assert.False(t, secondReadBeforeCommit)
			assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest), "反向边须在重新读取已提交关系后拒绝: %v", err)
			relations, err := service.List(ctx, projectID.String())
			require.NoError(t, err)
			assert.Len(t, relations, 1)
		})
	}
}

func TestRoadmapRelationHiddenPathCannotBecomeCycleOnRestore(t *testing.T) {
	db := setupIntegrationDB(t)
	projectID := seedRelationProject(t, db)
	a, b, c := seedRelationItem(t, db, projectID, 1), seedRelationItem(t, db, projectID, 2), seedRelationItem(t, db, projectID, 3)
	service := approadmap.NewRelationService(NewRoadmapRelationRepository(db), relationIntegrationChecker{}, appshared.NoopEventBus{})
	ctx := relationIntegrationContext()
	for _, pair := range [][2]*domain.Item{{a, b}, {b, c}} {
		_, err := service.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: pair[0].ID().String(), TargetID: pair[1].ID().String(), Type: "blocks"})
		require.NoError(t, err)
	}
	require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NOW() WHERE id = ?", b.ID().UUID()).Error)
	relations, err := service.List(ctx, projectID.String())
	require.NoError(t, err)
	assert.Empty(t, relations)
	_, err = service.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: c.ID().String(), TargetID: a.ID().String(), Type: "blocks"})
	assert.True(t, shared.IsDomainError(err, shared.CodeBadRequest))
	_, err = service.Create(ctx, projectID.String(), approadmap.CreateRelationInput{SourceID: a.ID().String(), TargetID: b.ID().String(), Type: "fixes"})
	assert.ErrorIs(t, err, domain.ErrNotFound)
	require.NoError(t, db.Exec("UPDATE roadmap_items SET deleted_at = NULL WHERE id = ?", b.ID().UUID()).Error)
	relations, err = service.List(ctx, projectID.String())
	require.NoError(t, err)
	assert.Len(t, relations, 2)
}
