// cache_mem.go 内存缓存:golang-lru LRU + TTI 失效。
package image

import (
	"time"

	lru "github.com/hashicorp/golang-lru/v2"

	domainimage "blog-api/internal/domain/image"
)

type memEntry struct {
	result  domainimage.TransformResult
	expires time.Time
}

// MemoryCache 内存 LRU + TTI
type MemoryCache struct {
	cache *lru.Cache[string, memEntry]
	ttl   time.Duration
}

// NewMemoryCache 创建内存缓存。size 为条目上限,ttl 为存活时间(TTI,写入时起算)。
func NewMemoryCache(size int, ttl time.Duration) *MemoryCache {
	c, _ := lru.New[string, memEntry](size)
	return &MemoryCache{cache: c, ttl: ttl}
}

func (m *MemoryCache) Get(key string) (domainimage.TransformResult, error) {
	e, ok := m.cache.Get(key)
	if !ok || time.Now().After(e.expires) {
		return domainimage.TransformResult{}, nil
	}
	return e.result, nil
}

func (m *MemoryCache) Set(key string, result domainimage.TransformResult) error {
	m.cache.Add(key, memEntry{result: result, expires: time.Now().Add(m.ttl)})
	return nil
}

var _ domainimage.ImageCache = (*MemoryCache)(nil)
