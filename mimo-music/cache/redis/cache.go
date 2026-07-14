// Package redis 实现 Cache 接口的 Redis 存储。
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/VOD-Studio/mimo-music/provider"
)

// Cache 是基于 Redis 的 Cache 实现。
type Cache struct {
	// rdb 是 Redis 客户端。
	rdb *redis.Client
}

// New 创建 Redis Cache。
func New(rdb *redis.Client) *Cache {
	return &Cache{rdb: rdb}
}

// 编译期断言。
var _ provider.Cache = (*Cache)(nil)

// Get 按 key 取缓存值。
func (c *Cache) Get(ctx context.Context, key string) (string, bool, error) {
	val, err := c.rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("读取缓存失败: %w", err)
	}
	return val, true, nil
}

// Set 写入缓存，带 TTL（秒）。
func (c *Cache) Set(ctx context.Context, key, value string, ttlSeconds int) error {
	ttl := time.Duration(ttlSeconds) * time.Second
	if err := c.rdb.Set(ctx, key, value, ttl).Err(); err != nil {
		return fmt.Errorf("写入缓存失败: %w", err)
	}
	return nil
}

// Delete 删除缓存 key。
func (c *Cache) Delete(ctx context.Context, key string) error {
	if err := c.rdb.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("删除缓存失败: %w", err)
	}
	return nil
}
