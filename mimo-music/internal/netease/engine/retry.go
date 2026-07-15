// Package engine 的指数退避重试。
//
// 旧架构的 RetryProvider 装饰器包装 Provider 的 8 个能力子接口（每个方法各写一遍重试）。
// 新架构 engine 只有一个 RawDo 深方法，retry 直接包装它，一个 withRetry 函数覆盖全部。
package engine

import (
	"context"
	"errors"
	"time"

	merrors "github.com/VOD-Studio/mimo-music/errors"
)

// retryPolicy 是重试策略配置。
type retryPolicy struct {
	// maxRetries 是最大重试次数（不含首次）。
	maxRetries int
	// baseDelay 是退避初始间隔，每次翻倍。
	baseDelay time.Duration
}

// defaultRetryPolicy 是地基阶段的默认重试策略。
var defaultRetryPolicy = retryPolicy{
	maxRetries: 3,
	baseDelay:  200 * time.Millisecond,
}

// isRetryable 判断错误是否可重试（网络错误 / 限流），确定性错误不重试。
func isRetryable(err error) bool {
	return errors.Is(err, merrors.ErrUpstreamUnavailable) || errors.Is(err, merrors.ErrRateLimited)
}

// withRetry 执行 fn，失败时按指数退避重试。
//
// 只对可重试错误（上游不可用 / 限流）重试，确定性错误（404 / 未授权）直接返回。
func withRetry(ctx context.Context, policy retryPolicy, fn func() error) error {
	var err error
	for attempt := 0; attempt <= policy.maxRetries; attempt++ {
		err = fn()
		if err == nil || !isRetryable(err) {
			return err
		}
		if attempt < policy.maxRetries {
			delay := policy.baseDelay * (1 << attempt)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
	}
	return err
}
