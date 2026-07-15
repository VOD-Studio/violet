// Package cache 定义缓存接口及其实现。
//
// Cache 接口由 engine 层依赖（依赖倒置），运行时层注入 Redis 或 noop 实现。
// value 用 []byte（proto 序列化的天然格式），TTL 用 time.Duration。
package cache

import (
	"context"
	"time"
)

// Cache 是缓存接口。engine.Execute 通过它缓存 proto 序列化后的响应。
type Cache interface {
	// Get 按 key 取缓存值，未命中返回 nil 和 false。
	Get(ctx context.Context, key string) ([]byte, bool, error)

	// Set 写入缓存，带 TTL。
	Set(ctx context.Context, key string, value []byte, ttl time.Duration) error

	// Delete 删除缓存 key。
	Delete(ctx context.Context, key string) error
}
