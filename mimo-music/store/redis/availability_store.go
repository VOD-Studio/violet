// Package redis 实现 SessionStore 接口及其周边状态的 Redis 存储。
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// availKeyPrefix 是 session 可用性标记的 key 前缀。
//
// key 格式：mimo-music:session-unavail:{userID}
// 存在表示不可用，不存在表示可用（默认可用，减少写入）。
const availKeyPrefix = "mimo-music:session-unavail:"

// AvailabilityStore 是基于 Redis 的 session 可用性存储。
type AvailabilityStore struct {
	// rdb 是 Redis 客户端。
	rdb *redis.Client

	// unavailTTL 是不可用标记的过期时间。
	//
	// 超时后自动恢复可用，避免 worker 健康检查没跑时永远跳过。
	unavailTTL time.Duration
}

// NewAvailabilityStore 创建 Redis AvailabilityStore。
func NewAvailabilityStore(rdb *redis.Client) *AvailabilityStore {
	return &AvailabilityStore{rdb: rdb, unavailTTL: 30 * time.Minute}
}

// IsAvailable 检查 session 是否可用（标记不存在即可用）。
func (s *AvailabilityStore) IsAvailable(ctx context.Context, userID string) (bool, error) {
	n, err := s.rdb.Exists(ctx, availKeyPrefix+userID).Result()
	if err != nil {
		return false, fmt.Errorf("查询 session 可用性失败: %w", err)
	}
	return n == 0, nil
}

// SetAvailable 标记 session 可用（删除不可用标记）。
func (s *AvailabilityStore) SetAvailable(ctx context.Context, userID string) error {
	if err := s.rdb.Del(ctx, availKeyPrefix+userID).Err(); err != nil {
		return fmt.Errorf("恢复 session 可用性失败: %w", err)
	}
	return nil
}

// SetUnavailable 标记 session 不可用（设置带 TTL 的标记）。
func (s *AvailabilityStore) SetUnavailable(ctx context.Context, userID string) error {
	if err := s.rdb.Set(ctx, availKeyPrefix+userID, "1", s.unavailTTL).Err(); err != nil {
		return fmt.Errorf("标记 session 不可用失败: %w", err)
	}
	return nil
}
