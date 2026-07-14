// Package redis 提供 mimo-music 的共享 Redis 客户端。
//
// cache / store / asynq 三个组件共用同一个 Redis 连接池，
// 避免维护多份连接。server 和 worker 启动时各自调用 New 初始化。
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/VOD-Studio/mimo-music/config"
)

// New 创建共享 Redis 客户端。
//
// 读取 RedisConfig 配置连接池参数，启动后做一次 ping 健康检查，
// 连接不可用时返回错误，调用方应让进程退出而非降级。
func New(cfg config.RedisConfig) (*redis.Client, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr(),
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     cfg.PoolSize,
		MinIdleConns: cfg.PoolSize / 5,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("Redis 健康检查失败: %w", err)
	}

	return rdb, nil
}
