package image

import (
	"container/list"
	"sync"
	"time"

	domainimage "blog-api/internal/domain/image"
	domainsettings "blog-api/internal/domain/settings"
)

type memEntry struct {
	key     string
	result  domainimage.TransformResult
	created time.Time
}

// MemoryCache 同时约束条目、字节与写入 TTL；调整策略后下次操作立即收敛。
type MemoryCache struct {
	mu       sync.Mutex
	entries  map[string]*list.Element
	order    *list.List
	bytes    int64
	policies domainimage.PolicyProvider
}

// NewMemoryCache 创建受运行策略约束的 LRU 缓存。
func NewMemoryCache(policies domainimage.PolicyProvider) *MemoryCache {
	return &MemoryCache{entries: make(map[string]*list.Element), order: list.New(), policies: policies}
}

func (m *MemoryCache) remove(element *list.Element) {
	entry := element.Value.(memEntry)
	m.bytes -= int64(len(entry.result.Bytes))
	delete(m.entries, entry.key)
	m.order.Remove(element)
}

func (m *MemoryCache) trim(policy domainsettings.ImagePolicy, now time.Time) {
	for element := m.order.Back(); element != nil; {
		previous := element.Prev()
		entry := element.Value.(memEntry)
		if now.Sub(entry.created) >= time.Duration(policy.MemoryTTLSeconds)*time.Second {
			m.remove(element)
		}
		element = previous
	}
	for m.order.Len() > policy.MemoryMaxEntries || m.bytes > policy.MemoryMaxBytes {
		m.remove(m.order.Back())
	}
}

func (m *MemoryCache) Get(key string) (domainimage.TransformResult, error) {
	policy := imagePolicy(m.policies)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.trim(policy, time.Now())
	if element := m.entries[key]; element != nil {
		m.order.MoveToFront(element)
		return element.Value.(memEntry).result, nil
	}
	return domainimage.TransformResult{}, nil
}

func (m *MemoryCache) Set(key string, result domainimage.TransformResult) error {
	policy := imagePolicy(m.policies)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.trim(policy, time.Now())
	if old := m.entries[key]; old != nil {
		m.remove(old)
	}
	if len(result.Bytes) == 0 || int64(len(result.Bytes)) > policy.MemoryMaxBytes {
		return nil
	}
	m.entries[key] = m.order.PushFront(memEntry{key: key, result: result, created: time.Now()})
	m.bytes += int64(len(result.Bytes))
	m.trim(policy, time.Now())
	return nil
}

// Cleanup 清除闲置缓存的到期项和超额项。
func (m *MemoryCache) Cleanup() {
	policy := imagePolicy(m.policies)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.trim(policy, time.Now())
}

var _ domainimage.ImageCache = (*MemoryCache)(nil)
