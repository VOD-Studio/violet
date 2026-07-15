// Package cache 的空实现。
package cache

import (
	"context"
	"time"
)

// Noop 是 Cache 的空实现，永远未命中，不做任何存储。
// 地基阶段未接入 Redis 时用。
type Noop struct{}

// Get 永远未命中。
func (Noop) Get(context.Context, string) ([]byte, bool, error) {
	return nil, false, nil
}

// Set 不做任何事。
func (Noop) Set(context.Context, string, []byte, time.Duration) error {
	return nil
}

// Delete 不做任何事。
func (Noop) Delete(context.Context, string) error {
	return nil
}
