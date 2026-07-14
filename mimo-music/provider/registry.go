// Package provider 定义 mimo-music 的平台抽象核心层。
package provider

import (
	"fmt"
	"sync"
)

// Registry 按 platform 标识路由到具体 Provider 实现。
//
// server / service 通过 Registry.Get("netease") 拿到 provider，
// 不直接依赖具体实现。加新平台只需 Register，不动调用方。
type Registry interface {
	// Get 按 platform 返回对应 Provider。
	Get(platform string) (Provider, error)

	// Register 注册一个 Provider。
	Register(p Provider) error
}

// DefaultRegistry 是 Registry 的默认实现，线程安全。
type DefaultRegistry struct {
	mu        sync.RWMutex
	providers map[string]Provider
}

// NewDefaultRegistry 创建空 Registry。
func NewDefaultRegistry() *DefaultRegistry {
	return &DefaultRegistry{providers: make(map[string]Provider)}
}

// Get 按 platform 返回 Provider，不存在返回 ErrUnsupportedPlatform。
func (r *DefaultRegistry) Get(platform string) (Provider, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	p, ok := r.providers[platform]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedPlatformErr, platform)
	}
	return p, nil
}

// Register 注册 Provider，重复 platform 覆盖。
func (r *DefaultRegistry) Register(p Provider) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.providers[p.Platform()] = p
	return nil
}

// ErrUnsupportedPlatformErr 是 platform 不存在时的错误。
//
// 放在 provider 包而非 errors 包，因为它是 Registry 层的错误。
var ErrUnsupportedPlatformErr = fmt.Errorf("不支持的平台")
