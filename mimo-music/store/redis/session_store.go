// Package redis 实现 SessionStore 接口的 Redis 存储。
//
// Cookie 按 user_id 索引存入 Redis，并发安全（Redis 单线程）。
// worker 健康检查通过 ListAll 遍历所有 session。
package redis

import (
	"context"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"

	"github.com/VOD-Studio/mimo-music/provider"
)

// sessionKeyPrefix 是 Redis 中 session 的 key 前缀。
const sessionKeyPrefix = "mimo-music:session:"

// SessionStore 是基于 Redis 的 SessionStore 实现。
type SessionStore struct {
	// rdb 是 Redis 客户端。
	rdb *redis.Client
}

// NewSessionStore 创建 Redis SessionStore。
func NewSessionStore(rdb *redis.Client) *SessionStore {
	return &SessionStore{rdb: rdb}
}

// 编译期断言。
var _ provider.SessionStore = (*SessionStore)(nil)

// Get 按 userID 取 Cookie。
func (s *SessionStore) Get(ctx context.Context, userID string) (string, error) {
	val, err := s.rdb.Get(ctx, sessionKeyPrefix+userID).Result()
	if err == redis.Nil {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("读取 session 失败: %w", err)
	}
	return val, nil
}

// Save 保存 Cookie，关联 userID。
func (s *SessionStore) Save(ctx context.Context, userID, cookie string) error {
	if err := s.rdb.Set(ctx, sessionKeyPrefix+userID, cookie, 0).Err(); err != nil {
		return fmt.Errorf("保存 session 失败: %w", err)
	}
	return nil
}

// Delete 删除 session。
func (s *SessionStore) Delete(ctx context.Context, userID string) error {
	if err := s.rdb.Del(ctx, sessionKeyPrefix+userID).Err(); err != nil {
		return fmt.Errorf("删除 session 失败: %w", err)
	}
	return nil
}

// ListAll 列出所有 session 的 userID（worker 健康检查用）。
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
