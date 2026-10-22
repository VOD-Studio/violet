package image

import (
	"context"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/require"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

type blockingTransformer struct {
	started chan struct{}
	release chan struct{}
	calls   atomic.Int32
}

func (f *blockingTransformer) Transform(ctx context.Context, source []byte, _ domainimage.TransformParams, _ domainsettings.ImagePolicy) (domainimage.TransformResult, error) {
	if f.calls.Add(1) == 1 {
		close(f.started)
	}
	select {
	case <-ctx.Done():
		return domainimage.TransformResult{}, ctx.Err()
	case <-f.release:
		return domainimage.TransformResult{Bytes: source, MimeType: "image/jpeg"}, nil
	}
}

type serveOutcome struct {
	result domainimage.TransformResult
	err    error
}

func serveAsync(service *Service, ctx context.Context) <-chan serveOutcome {
	completed := make(chan serveOutcome, 1)
	go func() {
		result, err := service.Serve(ctx, "/uploads/sample.jpg", domainimage.TransformParams{Width: 50})
		completed <- serveOutcome{result: result, err: err}
	}()
	return completed
}

func newBlockingService(t *testing.T) (*Service, *blockingTransformer) {
	t.Helper()
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "sample.jpg"), []byte("shared-image"), 0o600))
	transformer := &blockingTransformer{
		started: make(chan struct{}),
		release: make(chan struct{}),
	}
	service := NewService(transformer, &fakeCache{store: map[string]domainimage.TransformResult{}}, root, "/uploads", nil)
	t.Cleanup(service.Close)
	return service, transformer
}

func TestFirstWaiterCancellationDoesNotCancelSharedTransform(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, transformer := newBlockingService(t)
		firstCtx, cancelFirst := context.WithCancel(context.Background())
		defer cancelFirst()
		first := serveAsync(service, firstCtx)
		<-transformer.started
		second := serveAsync(service, context.Background())
		// 所有请求停在共享结果上后，才取消首个请求。
		synctest.Wait()
		cancelFirst()
		synctest.Wait()
		require.ErrorIs(t, (<-first).err, context.Canceled)
		select {
		case outcome := <-second:
			t.Fatalf("首个请求取消不应结束其他等待者: %v", outcome.err)
		default:
		}
		close(transformer.release)
		synctest.Wait()
		outcome := <-second
		require.NoError(t, outcome.err)
		require.Equal(t, "shared-image", string(outcome.result.Bytes))
		require.Equal(t, int32(1), transformer.calls.Load())
		cached, err := service.Serve(context.Background(), "/uploads/sample.jpg", domainimage.TransformParams{Width: 50})
		require.NoError(t, err)
		require.Equal(t, outcome.result.Bytes, cached.Bytes)
		require.Equal(t, int32(1), transformer.calls.Load())
	})
}

func TestServiceCloseCancelsSharedTransformAndAllWaiters(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, transformer := newBlockingService(t)
		first := serveAsync(service, context.Background())
		<-transformer.started
		second := serveAsync(service, context.Background())
		synctest.Wait()
		service.Close()
		synctest.Wait()
		require.ErrorIs(t, (<-first).err, context.Canceled)
		require.ErrorIs(t, (<-second).err, context.Canceled)
		require.Equal(t, int32(1), transformer.calls.Load())
		_, err := service.Serve(context.Background(), "/uploads/sample.jpg", domainimage.TransformParams{})
		require.ErrorIs(t, err, context.Canceled)
	})
}

func TestSharedTransformRetainsPolicyDeadlineWithoutWaiters(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service, transformer := newBlockingService(t)
		firstCtx, cancelFirst := context.WithCancel(context.Background())
		first := serveAsync(service, firstCtx)
		<-transformer.started
		cancelFirst()
		synctest.Wait()
		require.ErrorIs(t, (<-first).err, context.Canceled)
		// 请求取消不停止共享任务；策略超时必须独立结束它。
		second := serveAsync(service, context.Background())
		synctest.Wait()
		outcome := <-second
		require.ErrorIs(t, outcome.err, context.DeadlineExceeded)
		require.Equal(t, int32(1), transformer.calls.Load())
	})
}
