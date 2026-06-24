// composite.go 组合内存 + 磁盘二级缓存。
//
// Get:先查内存,未命中查磁盘并回填内存。
// Set:先写磁盘(持久),再写内存(加速)。
package image

import domainimage "blog-api/internal/domain/image"

// CompositeCache 组合内存 + 磁盘缓存
type CompositeCache struct {
	mem  *MemoryCache
	disk *DiskCache
}

// NewCompositeCache 创建二级缓存
func NewCompositeCache(mem *MemoryCache, disk *DiskCache) *CompositeCache {
	return &CompositeCache{mem: mem, disk: disk}
}

func (c *CompositeCache) Get(key string) (domainimage.TransformResult, error) {
	if r, _ := c.mem.Get(key); r.Bytes != nil {
		return r, nil
	}
	if r, _ := c.disk.Get(key); r.Bytes != nil {
		_ = c.mem.Set(key, r) // 磁盘命中 → 回填内存
		return r, nil
	}
	return domainimage.TransformResult{}, nil
}

func (c *CompositeCache) Set(key string, result domainimage.TransformResult) error {
	_ = c.disk.Set(key, result)
	return c.mem.Set(key, result)
}

var _ domainimage.ImageCache = (*CompositeCache)(nil)
