// Package emoji 提供表情模块的基础设施实现（Redis 状态存储等）。
package emoji

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	domainemoji "blog-api/internal/domain/emoji"
	domainshared "blog-api/internal/domain/shared"
)

const (
	refetchStatusKey = "emoji:refetch:status"
	refetchLockKey   = "emoji:refetch:lock"
	refetchLockTTL   = 1 * time.Hour // 进程崩溃兜底过期
)

// RedisRefetchStatusStore RefetchStatusStore 的 Redis 实现。
type RedisRefetchStatusStore struct {
	rdb *redis.Client
}

// NewRefetchStatusStore 创建 Redis 状态存储。
func NewRefetchStatusStore(rdb *redis.Client) *RedisRefetchStatusStore {
	return &RedisRefetchStatusStore{rdb: rdb}
}

// Acquire 原子抢锁。锁已被持有返回 shared.Conflict。
func (s *RedisRefetchStatusStore) Acquire(ctx context.Context) error {
	ok, err := s.rdb.SetNX(ctx, refetchLockKey, "locked", refetchLockTTL).Result()
	if err != nil {
		return domainshared.Internal("抢夺重新拉取锁失败", err)
	}
	if !ok {
		return domainshared.Conflict("已有重新拉取任务在运行")
	}
	now := time.Now()
	status := domainemoji.RefetchStatus{
		State:      domainemoji.RefetchStateRunning,
		StartedAt:  &now,
		GroupsDone: 0,
	}
	body, _ := json.Marshal(status)
	if err := s.rdb.Set(ctx, refetchStatusKey, body, 0).Err(); err != nil {
		s.rdb.Del(ctx, refetchLockKey)
		return domainshared.Internal("写入重新拉取状态失败", err)
	}
	return nil
}

func (s *RedisRefetchStatusStore) SetProgress(ctx context.Context, p domainemoji.RefetchProgress) error {
	status, err := s.get(ctx)
	if err != nil {
		return err
	}
	if status == nil {
		return nil // 无运行中任务，忽略
	}
	status.GroupsDone = p.GroupsDone
	status.GroupsTotal = p.GroupsTotal
	return s.set(ctx, status)
}

func (s *RedisRefetchStatusStore) SetDone(ctx context.Context) error {
	now := time.Now()
	status, _ := s.get(ctx)
	if status == nil {
		status = &domainemoji.RefetchStatus{}
	}
	status.State = domainemoji.RefetchStateDone
	status.FinishedAt = &now
	if err := s.set(ctx, status); err != nil {
		return err
	}
	return s.rdb.Del(ctx, refetchLockKey).Err()
}

func (s *RedisRefetchStatusStore) SetFailed(ctx context.Context, errMsg string) error {
	now := time.Now()
	status, _ := s.get(ctx)
	if status == nil {
		status = &domainemoji.RefetchStatus{}
	}
	status.State = domainemoji.RefetchStateFailed
	status.FinishedAt = &now
	status.Error = errMsg
	if err := s.set(ctx, status); err != nil {
		return err
	}
	return s.rdb.Del(ctx, refetchLockKey).Err()
}

func (s *RedisRefetchStatusStore) Get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	status, err := s.get(ctx)
	if err != nil {
		return nil, err
	}
	if status == nil {
		return &domainemoji.RefetchStatus{State: domainemoji.RefetchStateIdle}, nil
	}
	return status, nil
}

func (s *RedisRefetchStatusStore) get(ctx context.Context) (*domainemoji.RefetchStatus, error) {
	body, err := s.rdb.Get(ctx, refetchStatusKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, domainshared.Internal("读取重新拉取状态失败", err)
	}
	var status domainemoji.RefetchStatus
	if err := json.Unmarshal(body, &status); err != nil {
		return nil, fmt.Errorf("解析重新拉取状态失败: %w", err)
	}
	return &status, nil
}

func (s *RedisRefetchStatusStore) set(ctx context.Context, status *domainemoji.RefetchStatus) error {
	body, _ := json.Marshal(status)
	return s.rdb.Set(ctx, refetchStatusKey, body, 0).Err()
}
