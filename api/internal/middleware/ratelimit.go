package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
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
				next.ServeHTTP(w, r)
				return
			}

			// 检查是否超过限制
			count := countCmd.Val()
			if count > 3 {
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

// getClientIP 获取客户端真实 IP 地址
// 优先从 X-Forwarded-For 和 X-Real-IP 头部获取
func getClientIP(r *http.Request) string {
	// 优先检查代理头
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// 取第一个 IP（原始客户端）
		if ip := extractFirstIP(forwarded); ip != "" {
			return ip
		}
	}

	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}

	// 回退到 RemoteAddr
	return r.RemoteAddr
}

// extractFirstIP 从 X-Forwarded-For 头部提取第一个 IP
// 格式通常为 "client, proxy1, proxy2"
func extractFirstIP(forwarded string) string {
	for i := 0; i < len(forwarded); i++ {
		if forwarded[i] == ',' {
			return forwarded[:i]
		}
	}
	return forwarded
}
