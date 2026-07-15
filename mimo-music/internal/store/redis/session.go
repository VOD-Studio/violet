// Package redis 实现 SessionStore 接口的 Redis 存储。
//
// 合并旧的 session_store + availability_store + session_rotator 三件套：
// session 按 user_id 索引存入 Redis，可用性标记用独立 key（带 TTL），
// round-robin 选取在 GetAvailable 内完成。
package redis

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/VOD-Studio/mimo-music/errors"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

const (
	// sessionKeyPrefix 是 session cookie 的 key 前缀。
	sessionKeyPrefix = "mimo-music:session:"
	// availKeyPrefix 是可用性标记的 key 前缀。存在表示不可用（减少写入）。
	availKeyPrefix = "mimo-music:session-unavail:"
	// unavailTTL 是不可用标记的过期时间。超时自动恢复，避免永久跳过。
	unavailTTL = 30 * time.Minute
)

// SessionStore 是基于 Redis 的 SessionStore 实现。
//
// 维护 round-robin 计数器，从 Redis 列出全部 session 后按可用性过滤、
// 取模选一个。调用方通过 ReportSuccess/ReportFailure 反馈结果。
type SessionStore struct {
	rdb     *redis.Client
	counter atomic.Uint64
}

// NewSessionStore 创建 Redis SessionStore。
func NewSessionStore(rdb *redis.Client) *SessionStore {
	return &SessionStore{rdb: rdb}
}

// 编译期断言。
var _ session.SessionStore = (*SessionStore)(nil)

// GetAvailable 按登录态需求选取一个可用 session。
//
// round-robin：列出全部 session → 排序保证取模稳定 → 过滤不可用 → 计数器取模。
// 全部不可用返回 ErrNoAvailableSession。
//
// 地基阶段 AuthAnonymous 和 AuthLoggedIn 共用同一 cookie 池（网易云匿名接口用任意
// 登录态 cookie 即可），后续 AuthRequirement 可驱动不同池。
func (s *SessionStore) GetAvailable(ctx context.Context, req session.AuthRequirement) (*session.Session, error) {
	userIDs, err := s.ListAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("列出 session 失败: %w", err)
	}
	if len(userIDs) == 0 {
		return nil, errors.ErrUnauthorized
	}

	// 排序保证 round-robin 计数器取模稳定。
	sort.Strings(userIDs)

	// 过滤不可用 session。
	available := make([]string, 0, len(userIDs))
	for _, uid := range userIDs {
		ok, availErr := s.rdb.Exists(ctx, availKeyPrefix+uid).Result()
		if availErr != nil {
			continue
		}
		if ok == 0 {
			available = append(available, uid)
		}
	}
	if len(available) == 0 {
		return nil, session.ErrNoAvailableSession
	}

	// round-robin 选取。
	idx := int(s.counter.Add(1)-1) % len(available)
	selected := available[idx]

	cookie, err := s.rdb.Get(ctx, sessionKeyPrefix+selected).Result()
	if err != nil {
		return nil, fmt.Errorf("读取 session 失败: %w", err)
	}
	if cookie == "" {
		return nil, fmt.Errorf("%w: session %s 的 cookie 为空", errors.ErrUnauthorized, selected)
	}

	return &session.Session{UserID: selected, Cookie: cookie}, nil
}

// ReportSuccess 上报 session 调用成功，恢复其可用性标记。
func (s *SessionStore) ReportSuccess(sessionID string) {
	_ = s.rdb.Del(context.Background(), availKeyPrefix+sessionID).Err()
}

// ReportFailure 上报 session 调用失败，标记为不可用（带 TTL）。
func (s *SessionStore) ReportFailure(sessionID string, _ error) {
	_ = s.rdb.Set(context.Background(), availKeyPrefix+sessionID, "1", unavailTTL).Err()
}

// Save 保存新 session（登录成功后写入 cookie 池）。
func (s *SessionStore) Save(ctx context.Context, sess *session.Session) error {
	if err := s.rdb.Set(ctx, sessionKeyPrefix+sess.UserID, sess.Cookie, 0).Err(); err != nil {
		return fmt.Errorf("保存 session 失败: %w", err)
	}
	return nil
}

// ListAll 列出全部 session 的 userID（worker 健康检查用）。
//
// 用 SCAN 遍历 session key 前缀，提取 userID。
func (s *SessionStore) ListAll(ctx context.Context) ([]string, error) {
	var userIDs []string
	iter := s.rdb.Scan(ctx, 0, sessionKeyPrefix+"*", 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		userID := strings.TrimPrefix(key, sessionKeyPrefix)
		userIDs = append(userIDs, userID)
	}
	if err := iter.Err(); err != nil {
		return nil, fmt.Errorf("列出 session 失败: %w", err)
	}
	return userIDs, nil
}
