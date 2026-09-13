package auth

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"blog-api/internal/domain/opsgrant"
)

// opsGrantKey 单条授权的 Redis key：opsgrant:<uid>:<sessionID>:<category>。
// TTL=剩余有效期，超时自动失效，无需后台清理。
func opsGrantKey(userID, sessionID string, category opsgrant.Category) string {
	return "opsgrant:" + userID + ":" + sessionID + ":" + category.String()
}

// RedisOpsGrantStore 基于 Redis 的短时运维授权存储。
//
// 同一 (用户, 会话, 类别) 只保留最新一条：重复签发覆盖旧授权并重置 TTL，
// 吊销按会话或用户粒度批量删除。
type RedisOpsGrantStore struct {
	// rdb Redis 客户端
	rdb *redis.Client
}

func NewRedisOpsGrantStore(rdb *redis.Client) *RedisOpsGrantStore {
	return &RedisOpsGrantStore{rdb: rdb}
}

// Issue 写入授权，TTL=授权剩余有效期。覆盖同键旧授权。
func (s *RedisOpsGrantStore) Issue(ctx context.Context, g opsgrant.Grant) error {
	ttl := time.Until(g.ExpiresAt())
	if ttl <= 0 {
		return fmt.Errorf("ops grant already expired")
	}
	if err := s.rdb.Set(ctx, opsGrantKey(g.UserID(), g.SessionID(), g.Category()),
		strconv.FormatInt(g.ExpiresAt().Unix(), 10), ttl).Err(); err != nil {
		return fmt.Errorf("issue ops grant: %w", err)
	}
	return nil
}

// Exists 判断指定用户/会话/类别的授权当前是否有效。
func (s *RedisOpsGrantStore) Exists(ctx context.Context, userID, sessionID string, category opsgrant.Category) (bool, error) {
	n, err := s.rdb.Exists(ctx, opsGrantKey(userID, sessionID, category)).Result()
	if err != nil {
		return false, fmt.Errorf("check ops grant: %w", err)
	}
	return n > 0, nil
}

// RevokeSession 吊销指定 session 的全部类别授权（退出/设备吊销时调用）。
func (s *RedisOpsGrantStore) RevokeSession(ctx context.Context, userID, sessionID string) error {
	pattern := "opsgrant:" + userID + ":" + sessionID + ":*"
	if err := s.deleteByPattern(ctx, pattern); err != nil {
		return fmt.Errorf("revoke ops grants for session: %w", err)
	}
	return nil
}

// RevokeUser 吊销指定用户的全部授权（改密/重置密码/撤权时调用）。
func (s *RedisOpsGrantStore) RevokeUser(ctx context.Context, userID string) error {
	pattern := "opsgrant:" + userID + ":*"
	if err := s.deleteByPattern(ctx, pattern); err != nil {
		return fmt.Errorf("revoke ops grants for user: %w", err)
	}
	return nil
}

func (s *RedisOpsGrantStore) deleteByPattern(ctx context.Context, pattern string) error {
	var cursor uint64
	for {
		keys, next, err := s.rdb.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return fmt.Errorf("scan ops grants: %w", err)
		}
		if len(keys) > 0 {
			if err := s.rdb.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("delete ops grants: %w", err)
			}
		}

		if next == 0 {
			return nil
		}
		cursor = next
	}
}


// RevokeAll 吊销全部运维授权（SCAN 渐进匹配 opsgrant:*）。
func (s *RedisOpsGrantStore) RevokeAll(ctx context.Context) error {
	return s.deleteByPattern(ctx, "opsgrant:*")
}