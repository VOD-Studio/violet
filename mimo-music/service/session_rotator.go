// Package service 提供 mimo-music 的业务编排层。
//
// session_rotator.go 实现 Cookie 多账号轮换策略。
package service

import (
	"context"
	"fmt"
	"sort"
	"sync/atomic"

	"github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/provider"
)

// SessionRotator 是 Cookie 多账号轮换器。
//
// 维护一个 round-robin 计数器，从 SessionStore 中按轮换策略取下一个可用 Cookie。
// provider 返回 Cookie 失效错误时，调用 MarkUnavailable 跳过该 session。
// worker 健康检查恢复后调用 MarkAvailable 重新纳入轮换。
//
// 可用性状态通过 availabilityStore 持久化（Redis），重启后不丢。
type SessionRotator struct {
	store          provider.SessionStore
	avail          AvailabilityStore
	counter        atomic.Uint64
}

// AvailabilityStore 是 session 可用性状态存储接口。
//
// 与 SessionStore 分离，因为可用性是轮换层的附加状态，不侵入核心接口。
// store/redis 提供实现。
type AvailabilityStore interface {
	// IsAvailable 检查 session 是否可用。
	IsAvailable(ctx context.Context, userID string) (bool, error)

	// SetAvailable 标记 session 可用（恢复）。
	SetAvailable(ctx context.Context, userID string) error

	// SetUnavailable 标记 session 不可用（失效跳过）。
	SetUnavailable(ctx context.Context, userID string) error
}

// NewSessionRotator 创建 Cookie 轮换器。
func NewSessionRotator(store provider.SessionStore, avail AvailabilityStore) *SessionRotator {
	return &SessionRotator{store: store, avail: avail}
}

// NextCookie 按 round-robin 取下一个可用 session 的 Cookie。
//
// 遍历所有 session，过滤掉不可用的，按计数器取模选一个。
// 所有 session 都不可用时返回 ErrNoAvailableSession。
func (r *SessionRotator) NextCookie(ctx context.Context) (userID, cookie string, err error) {
	userIDs, err := r.store.ListAll(ctx)
	if err != nil {
		return "", "", fmt.Errorf("列出 session 失败: %w", err)
	}
	if len(userIDs) == 0 {
		return "", "", errors.ErrUnauthorized
	}

	// 排序保证 round-robin 计数器取模的稳定性（map 迭代顺序不确定）
	sort.Strings(userIDs)

	// 过滤可用 session
	available := make([]string, 0, len(userIDs))
	for _, uid := range userIDs {
		ok, availErr := r.avail.IsAvailable(ctx, uid)
		if availErr != nil {
			continue
		}
		if ok {
			available = append(available, uid)
		}
	}
	if len(available) == 0 {
		return "", "", ErrNoAvailableSession
	}

	// round-robin
	idx := int(r.counter.Add(1)-1) % len(available)
	selected := available[idx]

	cookie, err = r.store.Get(ctx, selected)
	if err != nil {
		return "", "", fmt.Errorf("读取 session 失败: %w", err)
	}
	if cookie == "" {
		return "", "", fmt.Errorf("%w: session %s 的 cookie 为空", errors.ErrUnauthorized, selected)
	}

	return selected, cookie, nil
}

// MarkUnavailable 标记 session 不可用，轮换时跳过。
func (r *SessionRotator) MarkUnavailable(ctx context.Context, userID string) error {
	return r.avail.SetUnavailable(ctx, userID)
}

// MarkAvailable 标记 session 恢复可用。
func (r *SessionRotator) MarkAvailable(ctx context.Context, userID string) error {
	return r.avail.SetAvailable(ctx, userID)
}

// ErrNoAvailableSession 是所有 session 都不可用时的错误。
var ErrNoAvailableSession = fmt.Errorf("所有 session 均不可用")
