// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// CommentRateLimit 评论限流中间件
// 基于 IP 的 Redis 滑动窗口限流，限制每个 IP 每分钟最多发送 3 条评论
func CommentRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 获取客户端 IP 地址
			ip := getClientIP(r)

			// Redis 滑动窗口限流 key
			key := fmt.Sprintf("ratelimit:comment:%s", ip)

			ctx := r.Context()
			now := time.Now()
			windowStart := now.Add(-1 * time.Minute)

			// 使用 Redis 管道批量执行操作
			pipe := redisClient.Pipeline()

			// 清除窗口外的旧记录
			pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart.UnixMicro()))

			// 统计当前窗口内的请求数
			countCmd := pipe.ZCard(ctx, key)

			// 添加当前请求到滑动窗口
			pipe.ZAdd(ctx, key, redis.Z{
				Score:  float64(now.UnixMicro()),
				Member: fmt.Sprintf("%d", now.UnixNano()),
			})

			// 设置 key 过期时间，自动清理
			pipe.Expire(ctx, key, 2*time.Minute)

			// 执行管道命令
			if _, err := pipe.Exec(ctx); err != nil {
				// Redis 出错时放行请求，避免因限流服务故障导致全部请求被拒
				log.Error().
					Err(err).
					Str("ip", ip).
					Str("path", r.URL.Path).
					Msg("限流 Redis 操作失败，放行请求")
				next.ServeHTTP(w, r)
				return
			}

			// 检查是否超过限制
			count := countCmd.Val()
			if count > 3 {
				log.Warn().
					Str("ip", ip).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Int64("count", count).
					Msg("触发限流")
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate_limit_exceeded","message":"评论过于频繁，请稍后再试"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
