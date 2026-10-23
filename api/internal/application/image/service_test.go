package image

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
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

func TestServeRequestQualityDoesNotReuseLegacyWebPCache(t *testing.T) {
	root := t.TempDir()
	source := []byte("source")
	require.NoError(t, os.WriteFile(filepath.Join(root, "sample.png"), source, 0o600))
	policy := domainsettings.DefaultImagePolicy()
	params := domainimage.TransformParams{Width: 50, Format: "webp", Quality: 80}
	// 模拟旧版本持久化的缓存条目：质量在 key 中，但输出仍遵循无损策略。
	hash := sha256.New()
	hash.Write(source)
	fmt.Fprintf(hash, "\x00%s\x00%d\x00%+v", params.Key(), uint64(0), policy)
	legacyKey := hex.EncodeToString(hash.Sum(nil))
	cache := &fakeCache{store: map[string]domainimage.TransformResult{
		legacyKey: {Bytes: []byte("legacy lossless"), MimeType: "image/webp"},
	}}
	tr := &fakeTransformer{}
	svc := NewService(tr, cache, root, "/uploads/", nil)
	defer svc.Close()
	for _, quality := range []int{80, 80, 60, 60, 0, 0} {
		params.Quality = quality
		result, err := svc.Serve(context.Background(), "/uploads/sample.png", params)
		require.NoError(t, err)
		require.Equal(t, source, result.Bytes)
	}
	require.Equal(t, 3, tr.calls)
}
