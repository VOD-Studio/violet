package image

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainsettings "blog-api/internal/domain/settings"
)

type mutablePolicy struct {
	policy  domainsettings.ImagePolicy
	version uint64
}

func (p *mutablePolicy) Image() (domainsettings.ImagePolicy, uint64) { return p.policy, p.version }

func TestMemoryCacheAppliesEntryByteAndTTLChanges(t *testing.T) {
	provider := &mutablePolicy{policy: domainsettings.DefaultImagePolicy()}
	cache := NewMemoryCache(provider)
	provider.policy.MemoryMaxEntries = 2
	for _, key := range []string{"first", "second", "third"} {
		require.NoError(t, cache.Set(key, sampleResult()))
	}
	result, err := cache.Get("first")
	require.NoError(t, err)
	require.Nil(t, result.Bytes)
	require.Equal(t, int64(18), cache.bytes)
	provider.policy.MemoryMaxBytes = 9
	_, err = cache.Get("third")
	require.NoError(t, err)
	require.Equal(t, int64(9), cache.bytes)
	provider.policy.MemoryMaxBytes = 1
	require.NoError(t, cache.Set("oversized", sampleResult()))
	require.Zero(t, cache.bytes)
	provider.policy.MemoryMaxBytes = 9
	require.NoError(t, cache.Set("expired", sampleResult()))
	entry := cache.entries["expired"].Value.(memEntry)
	entry.created = time.Now().Add(-2 * time.Second)
	cache.entries["expired"].Value = entry
	provider.policy.MemoryTTLSeconds = 1
	cache.Cleanup()
	require.Zero(t, cache.bytes)
}

func TestDiskCacheCapacityTTLAndDedicatedMaintenance(t *testing.T) {
	provider := &mutablePolicy{policy: domainsettings.DefaultImagePolicy()}
	provider.policy.DiskMaxBytes = 18
	root := t.TempDir()
	cache := NewDiskCache(root, provider)
	require.NoError(t, cache.Set("first", sampleResult()))
	first := filepath.Join(root, diskName("first")+".webp")
	old := time.Now().Add(-time.Hour)
	require.NoError(t, os.Chtimes(first, old, old))
	require.NoError(t, cache.Set("second", sampleResult()))
	require.NoError(t, cache.Set("third", sampleResult()))
	result, err := cache.Get("first")
	require.NoError(t, err)
	require.Nil(t, result.Bytes)
	unrelated := filepath.Join(root, "original.jpg")
	require.NoError(t, os.WriteFile(unrelated, []byte("保留素材"), 0o600))
	for _, key := range []string{"second", "third"} {
		path := filepath.Join(root, diskName(key)+".webp")
		require.NoError(t, os.Chtimes(path, old, old))
	}
	provider.policy.DiskTTLSeconds = 1
	require.NoError(t, cache.Cleanup())
	status := cache.Status()
	require.Equal(t, 2, status.RemovedEntries)
	require.Equal(t, int64(18), status.RemovedBytes)
	require.Zero(t, status.RemainingBytes)
	require.NotNil(t, status.LastStartedAt)
	require.NotNil(t, status.LastFinishedAt)
	require.Empty(t, status.Error)
	require.False(t, status.Running)
	_, err = os.Stat(unrelated)
	require.NoError(t, err)
}

func TestDiskCacheReportsMaintenanceFailure(t *testing.T) {
	path := filepath.Join(t.TempDir(), "not-a-directory")
	require.NoError(t, os.WriteFile(path, []byte("file"), 0o600))
	cache := NewDiskCache(path, nil)
	require.Error(t, cache.Cleanup())
	require.NotEmpty(t, cache.Status().Error)
	require.NotNil(t, cache.Status().LastFinishedAt)
	require.False(t, cache.Status().Running)
}

func TestProcessorCapturesPolicyForWholeRequest(t *testing.T) {
	provider := &mutablePolicy{policy: domainsettings.DefaultImagePolicy()}
	processor := NewProcessor(t.TempDir(), "/uploads/", provider, NewEncoder())
	captured := processor.ForRequest(context.Background())
	provider.policy.MaxSourceDimension = 1
	_, err := captured.Validate(filepath.Join("testdata", "sample.png"))
	require.NoError(t, err)
	_, err = processor.ForRequest(context.Background()).Validate(filepath.Join("testdata", "sample.png"))
	require.Error(t, err)
}

func TestProcessorRejectsOversizedSourceBeforeDecode(t *testing.T) {
	provider := &mutablePolicy{policy: domainsettings.DefaultImagePolicy()}
	provider.policy.MaxInputBytes = 2
	processor := NewProcessor(t.TempDir(), "/uploads/", provider, NewEncoder())
	_, err := processor.Validate(filepath.Join("testdata", "sample.png"))
	require.ErrorContains(t, err, "输入字节")
	_, err = processor.Transcode(filepath.Join("testdata", "sample.png"), t.TempDir(), "image", "image/png")
	require.ErrorContains(t, err, "输入字节")
}
