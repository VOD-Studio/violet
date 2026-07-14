// Package provider 定义 mimo-music 的平台抽象核心层。
package provider

import "context"

// Cache 是核心层定义的缓存接口。
//
// provider 声明"我需要缓存"，但不绑定实现。运行时层（cache/redis）
// 提供 Redis 实现。SDK 用户可以传自己的实现，或用 noop。
type Cache interface {
	// Get 按 key 取缓存值，未命中返回空字符串和 false。
	Get(ctx context.Context, key string) (string, bool, error)

	// Set 写入缓存，带 TTL（秒）。
	Set(ctx context.Context, key, value string, ttlSeconds int) error

	// Delete 删除缓存 key。
	Delete(ctx context.Context, key string) error
}

// NoopCache 是 Cache 的空实现，不做任何缓存。
//
// SDK 模式默认用，避免强制依赖 Redis。
type NoopCache struct{}

// Get 永远未命中。
func (NoopCache) Get(context.Context, string) (string, bool, error) {
	return "", false, nil
}

// Set 不做任何事。
func (NoopCache) Set(context.Context, string, string, int) error {
	return nil
}

// Delete 不做任何事。
func (NoopCache) Delete(context.Context, string) error {
	return nil
}
