package image

import (
	"path/filepath"
	"testing"
	"time"

	domainimage "blog-api/internal/domain/image"
)

func sampleResult() domainimage.TransformResult {
	return domainimage.TransformResult{Bytes: []byte("imagedata"), MimeType: "image/webp", ETag: "abc123"}
}

// TestMemoryCache_SetGet 写入后应命中
func TestMemoryCache_SetGet(t *testing.T) {
	c := NewMemoryCache(100, 10*time.Second)
	_ = c.Set("k1", sampleResult())
	got, err := c.Get("k1")
	if err != nil || got.ETag != "abc123" {
		t.Fatalf("缓存未命中: %+v %v", got, err)
	}
}

// TestMemoryCache_TTIExpire 过期后不应命中
func TestMemoryCache_TTIExpire(t *testing.T) {
	c := NewMemoryCache(100, 20*time.Millisecond)
	_ = c.Set("k1", sampleResult())
	time.Sleep(50 * time.Millisecond)
	got, _ := c.Get("k1")
	if got.Bytes != nil {
		t.Fatal("过期后不应命中")
	}
}

// TestDiskCache_SetGet 磁盘写入后应命中
func TestDiskCache_SetGet(t *testing.T) {
	c := NewDiskCache(t.TempDir())
	_ = c.Set("k1", sampleResult())
	got, _ := c.Get("k1")
	if got.ETag == "" || got.MimeType != "image/webp" {
		t.Fatalf("磁盘缓存未命中: %+v", got)
	}
}

// TestCompositeCache_DiskBackfillMem 磁盘命中应回填内存
func TestCompositeCache_DiskBackfillMem(t *testing.T) {
	mem := NewMemoryCache(100, 10*time.Second)
	disk := NewDiskCache(t.TempDir())
	comp := NewCompositeCache(mem, disk)
	// 直接写磁盘,不写内存
	_ = disk.Set("k1", sampleResult())
	// 第一次 Get:走磁盘 → 回填内存(disk 会重算 ETag,故只验证 Bytes 命中)
	got, _ := comp.Get("k1")
	if len(got.Bytes) == 0 {
		t.Fatal("组合缓存应命中磁盘")
	}
	// 验证内存已被回填
	if mg, _ := mem.Get("k1"); len(mg.Bytes) == 0 {
		t.Fatal("磁盘命中后应回填内存")
	}
}

// TestCompositeCache_Set 双层写入后都应命中
func TestCompositeCache_Set(t *testing.T) {
	mem := NewMemoryCache(100, 10*time.Second)
	disk := NewDiskCache(filepath.Join(t.TempDir(), "cache"))
	comp := NewCompositeCache(mem, disk)
	_ = comp.Set("k1", sampleResult())
	// 内存层
	if mg, _ := mem.Get("k1"); mg.ETag != "abc123" {
		t.Fatal("内存层未命中")
	}
	// 磁盘层(disk 会重算 ETag,只验证 Bytes 命中)
	if dg, _ := disk.Get("k1"); len(dg.Bytes) == 0 {
		t.Fatal("磁盘层未命中")
	}
}
