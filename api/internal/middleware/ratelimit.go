// Package middleware 提供 HTTP 中间件，处理认证、日志、限流等横切关注点
package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// RateLimit 基于 IP 的 Redis 滑动窗口限流中间件工厂。
//
// key    限流维度标识（如 "comment"/"login"/"upload"），用于隔离不同接口的窗口
// client Redis 客户端
// window 时间窗口
// max    窗口内最大请求数（达到即拒绝）
func RateLimit(key string, client *redis.Client, window time.Duration, max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := getClientIP(r)
			redisKey := fmt.Sprintf("ratelimit:%s:%s", key, ip)

			ctx := r.Context()
			now := time.Now()
			windowStart := now.Add(-window)

			pipe := client.Pipeline()
			// 清除窗口外的旧记录
			pipe.ZRemRangeByScore(ctx, redisKey, "0", fmt.Sprintf("%d", windowStart.UnixMicro()))
			// 统计当前窗口内的请求数
			countCmd := pipe.ZCard(ctx, redisKey)
			// 添加当前请求到滑动窗口
			pipe.ZAdd(ctx, redisKey, redis.Z{
				Score:  float64(now.UnixMicro()),
				Member: fmt.Sprintf("%d", now.UnixNano()),
			})
			// 设置 key 过期时间，自动清理
			pipe.Expire(ctx, redisKey, 2*window)

			if _, err := pipe.Exec(ctx); err != nil {
				// Redis 出错时放行请求，避免因限流服务故障导致全部请求被拒
				log.Error().Err(err).Str("ip", ip).Str("path", r.URL.Path).
					Msg("限流 Redis 操作失败，放行请求")
				next.ServeHTTP(w, r)
				return
			}

			// 拒绝条件：countCmd 反映的是加入当前请求之前的窗口内请求数（ZCard 在 ZAdd 之前执行）。
			// 故 >= max 表示该请求已是第 (max+1) 个，放行前 max 个、拒绝后续。
			if countCmd.Val() >= max {
				log.Warn().Str("ip", ip).Str("key", key).Str("method", r.Method).
					Str("path", r.URL.Path).Int64("count", countCmd.Val()).Msg("触发限流")
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate_limit_exceeded","message":"请求过于频繁，请稍后再试"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CommentRateLimit 评论限流（每分钟 3 条）—— 保留以兼容现有调用
func CommentRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("comment", redisClient, time.Minute, 3)
}

// AuthRateLimit 认证类接口限流（登录/注册/忘记密码/重置/验证：每分钟 5 次，防暴力与邮件轰炸）
func AuthRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("auth", redisClient, time.Minute, 5)
}

// UploadRateLimit 上传类接口限流（每分钟 30 次，防资源 DoS）
func UploadRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("upload", redisClient, time.Minute, 30)
}
