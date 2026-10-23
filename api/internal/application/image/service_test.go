package image

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

type fakeTransformer struct{ calls int }

func (f *fakeTransformer) Transform(_ context.Context, source []byte, _ domainimage.TransformParams, _ domainsettings.ImagePolicy) (domainimage.TransformResult, error) {
	f.calls++
	return domainimage.TransformResult{Bytes: source, MimeType: "image/jpeg"}, nil
}

type fakeCache struct {
	mu    sync.Mutex
	store map[string]domainimage.TransformResult
}

func (f *fakeCache) Get(key string) (domainimage.TransformResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.store[key], nil
}
func (f *fakeCache) Set(key string, result domainimage.TransformResult) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.store[key] = result
	return nil
}

type mutablePolicy struct {
	values  domainsettings.ImagePolicy
	version uint64
}

func (p *mutablePolicy) Image() (domainsettings.ImagePolicy, uint64) { return p.values, p.version }

func TestServeContentAndPolicyIdentity(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "sample.jpg")
	require.NoError(t, os.WriteFile(path, []byte("first"), 0o600))
	tr := &fakeTransformer{}
	policy := &mutablePolicy{values: domainsettings.DefaultImagePolicy(), version: 1}
	svc := NewService(tr, &fakeCache{store: map[string]domainimage.TransformResult{}}, root, "/uploads/", policy)
	params := domainimage.TransformParams{Width: 50, Format: "jpeg"}
	for range 2 {
		result, err := svc.Serve(context.Background(), "/uploads/sample.jpg", params)
		require.NoError(t, err)
		require.Equal(t, "first", string(result.Bytes))
	}
	require.Equal(t, 1, tr.calls)
	// 同长度覆盖也必须失效，不能只比较路径、尺寸或时间戳。
	require.NoError(t, os.WriteFile(path, []byte("other"), 0o600))
	result, err := svc.Serve(context.Background(), "/uploads/sample.jpg", params)
	require.NoError(t, err)
	require.Equal(t, "other", string(result.Bytes))
	require.Equal(t, 2, tr.calls)
	policy.version++
	_, err = svc.Serve(context.Background(), "/uploads/sample.jpg", params)
	require.NoError(t, err)
	require.Equal(t, 3, tr.calls)
	policy.values.WebPQuality--
	_, err = svc.Serve(context.Background(), "/uploads/sample.jpg", params)
	require.NoError(t, err)
	require.Equal(t, 4, tr.calls)
	params.Width++
	_, err = svc.Serve(context.Background(), "/uploads/sample.jpg", params)
	require.NoError(t, err)
	require.Equal(t, 5, tr.calls)
	require.NoError(t, os.Remove(path))
	_, err = svc.Serve(context.Background(), "/uploads/sample.jpg", params)
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestServeCustomPrefixAndSourceBudget(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "sample.jpg"), []byte("data"), 0o600))
	tr := &fakeTransformer{}
	policy := &mutablePolicy{values: domainsettings.DefaultImagePolicy()}
	svc := NewService(tr, &fakeCache{store: map[string]domainimage.TransformResult{}}, root, "/media/", policy)
	_, err := svc.Serve(context.Background(), "/media/sample.jpg", domainimage.TransformParams{})
	require.NoError(t, err)
	for _, path := range []string{"/uploads/sample.jpg", "/media/../sample.jpg"} {
		_, err = svc.Serve(context.Background(), path, domainimage.TransformParams{})
		require.Error(t, err)
	}
	policy.values.MaxInputBytes = 3
	_, err = svc.Serve(context.Background(), "/media/sample.jpg", domainimage.TransformParams{})
	require.Error(t, err)
	require.Equal(t, 1, tr.calls)
}
