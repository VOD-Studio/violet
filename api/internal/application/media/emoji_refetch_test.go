package media

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
	domainshared "blog-api/internal/domain/shared"
)

// fakeReseeder 记录是否被调用
type fakeReseeder struct {
	called atomic.Bool
}

func (f *fakeReseeder) Reseed(ctx context.Context, cookie string, progress func(domainemoji.RefetchProgress)) error {
	f.called.Store(true)
	return nil
}

func (f *fakeReseeder) BilibiliCookieDefault() string { return "" }

// mockRefetchStore RefetchStatusStore 的 mock
type mockRefetchStore struct{ mock.Mock }

func (m *mockRefetchStore) Acquire(ctx context.Context) error {
	return m.Called(ctx).Error(0)
}
func (m *mockRefetchStore) SetProgress(ctx context.Context, p domainemoji.RefetchProgress) error {
	return m.Called(ctx, p).Error(0)
}
func (m *mockRefetchStore) SetDone(ctx context.Context) error {
	return m.Called(ctx).Error(0)
}
func (m *mockRefetchStore) SetFailed(ctx context.Context, errMsg string) error {
	return m.Called(ctx, errMsg).Error(0)
}
func (m *mockRefetchStore) Get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainemoji.RefetchStatus), args.Error(1)
}

func TestRefetch_RunsAsyncAndSetsDone(t *testing.T) {
	store := new(mockRefetchStore)
	store.On("Acquire", mock.Anything).Return(nil)
	store.On("SetProgress", mock.Anything, mock.Anything).Return(nil)

	// SetDone 被 goroutine 调用时关闭 done 通道，用于 race-free 同步
	done := make(chan struct{})
	store.On("SetDone", mock.Anything).Return(nil).Run(func(args mock.Arguments) {
		close(done)
	})
	store.On("Get", mock.Anything).Return(&domainemoji.RefetchStatus{State: domainemoji.RefetchStateRunning}, nil)

	runner := &fakeReseeder{}
	svc := &EmojiService{reseeder: runner, statusStore: store}

	status, err := svc.Refetch(context.Background(), "SESSDATA=fake")
	require.NoError(t, err)
	assert.Equal(t, domainemoji.RefetchStateRunning, status.State)

	// 等待 goroutine 完成（异步，SetDone 调用即代表整个流程结束）
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("等待 SetDone 超时：Reseed 未在 goroutine 内执行")
	}
	require.True(t, runner.called.Load(), "Reseed 应被调用")
	store.AssertCalled(t, "SetDone", mock.Anything)
}

func TestRefetch_AlreadyRunningReturnsConflict(t *testing.T) {
	store := new(mockRefetchStore)
	store.On("Acquire", mock.Anything).Return(domainshared.Conflict("已有重新拉取任务在运行"))

	svc := &EmojiService{reseeder: &fakeReseeder{}, statusStore: store}
	_, err := svc.Refetch(context.Background(), "SESSDATA=fake")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "已有重新拉取任务在运行")
	store.AssertNotCalled(t, "SetDone")
}
