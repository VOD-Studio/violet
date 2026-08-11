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
	return rateLimitByDimension(key, client, window, max, getClientIP)
}

// RateLimitByUser 基于登录用户 ID 的滑动窗口限流（须挂在 SessionAuth 之后）。
//
// 用户维度适配「防单用户刷屏」场景（如发推文）：共用出口 IP 的多用户互不挤占。
// 用户 ID 缺失时（中间件顺序错误）降级为 IP 维度，静默放行会架空限流。
func RateLimitByUser(key string, client *redis.Client, window time.Duration, max int64) func(http.Handler) http.Handler {
	return rateLimitByDimension(key, client, window, max, func(r *http.Request) string {
		if uid := GetUserID(r.Context()); uid != "" {
			return "u:" + uid
		}
		return getClientIP(r)
	})
}

// rateLimitByDimension 滑动窗口限流共享实现。dimension 从请求解析计数维度
// （IP / 用户 ID），拼入 redis key 隔离不同接口与维度。
func rateLimitByDimension(key string, client *redis.Client, window time.Duration, max int64, dimension func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			dim := dimension(r)
			redisKey := fmt.Sprintf("ratelimit:%s:%s", key, dim)

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
				log.Error().Err(err).Str("dim", dim).Str("path", r.URL.Path).
					Msg("限流 Redis 操作失败，放行请求")
				next.ServeHTTP(w, r)
				return
			}

			// 拒绝条件：countCmd 反映的是加入当前请求之前的窗口内请求数（ZCard 在 ZAdd 之前执行）。
			// 故 >= max 表示该请求已是第 (max+1) 个，放行前 max 个、拒绝后续。
			if countCmd.Val() >= max {
				log.Warn().Str("dim", dim).Str("key", key).Str("method", r.Method).
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

// CommentCodeRateLimit 评论验证码发送限流（每分钟 5 次/IP）。
//
// 阈值理由：5 次/min 对正常用户（输错邮箱重发、切换文章发码）足够宽松，
// 但能挡住邮件轰炸（攻击者用脚本对大量邮箱发垃圾验证码）。
//
// 与 CommentRateLimit（提交评论，3/min）走独立 key="comment_code"：
// 避免发码与提交共桶互相挤占——发码限流不应影响用户提交评论的能力。
func CommentCodeRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("comment_code", redisClient, time.Minute, 5)
}

// AuthRateLimit 认证类接口限流（登录/注册/忘记密码/重置/验证：每分钟 5 次，防暴力与邮件轰炸）
func AuthRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("auth", redisClient, time.Minute, 5)
}

// RefreshRateLimit 刷新令牌接口限流（每分钟 30 次）。
//
// refresh 走独立 key，避免与登录/注册共用的 "auth" 桶互相挤占：
// 前端并发请求触发自动刷新时可能短时多次调用，若与防爆破的 5/min 共桶
// 会被 429 误伤。refresh 由 HttpOnly Cookie proof-of-possession 保护，
// 无爆破风险，故配额放宽。
func RefreshRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("refresh", redisClient, time.Minute, 30)
}

// UploadRateLimit 上传类接口限流（每分钟 30 次，防资源 DoS）
func UploadRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("upload", redisClient, time.Minute, 30)
}

// TweetRateLimit 推文发布限流（每用户每小时 10 条，PRD-0013）。
//
// 即发即出模式的防刷屏兜底。按用户维度计数（须挂在 SessionAuth 之后）：
// IP 维度对共用出口 IP 的多用户会误伤，且换 IP 即绕过的单用户刷屏防不住。
func TweetRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimitByUser("tweet", redisClient, time.Hour, 10)
}

// CodeRunnerRateLimit 代码运行器限流（每分钟 5 次/IP）。
//
// 阈值理由：每次执行起一个 Docker 容器，资源开销大。5/min 对正常读者
// （试运行示例、调试代码）足够，但能挡住容器资源耗尽攻击。
// admin 角色的放行在 service 层之外由前端权限控制——此处按 IP 统一限流，
// 与 ygggrasil「admin 跳过速率限制」的差异：violet 的限流在中间件层，
// admin 判断需额外中间件，本期暂按 IP 统一限流（admin 同样受限，影响可忽略）。
func CodeRunnerRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("code_runner", redisClient, time.Minute, 5)
}

// FriendLinkRateLimit 友链申请限流
//
// 申请限流与发码限流走独立 key（friendlink vs friendlink_code），
// 避免发码与提交共桶互相挤占——发码限流不应影响用户提交申请的能力。
func FriendLinkRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("friendlink", redisClient, time.Minute, 3)
}

// FriendLinkCodeRateLimit 友链申请验证码发送限流（每分钟 5 次/IP，镜像 CommentCodeRateLimit）。
//
// 阈值理由：5 次/min 对正常用户（输错邮箱重发）足够宽松，
// 但能挡住邮件轰炸（攻击者用脚本对大量邮箱发垃圾验证码）。
func FriendLinkCodeRateLimit(redisClient *redis.Client) func(http.Handler) http.Handler {
	return RateLimit("friendlink_code", redisClient, time.Minute, 5)
}
