package coderunner

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainshared "blog-api/internal/domain/shared"
)

const taskKeyPrefix = "code_runner:task:"

// RedisTaskStore TaskRepository 的 Redis 实现。
//
// 任务 JSON 序列化存 Redis（带 TTL）。多副本部署时状态可共享。
// key 形如 code_runner:task:<id>。对应 yggdrasil 的 EXEC_TASKS（DashMap）的持久化版本。
type RedisTaskStore struct {
	rdb *redis.Client
	ttl time.Duration // 任务保留时长，到期 Redis 自动删除
}

// NewRedisTaskStore 创建 Redis 任务存储。ttl 为任务保留时长。
func NewRedisTaskStore(rdb *redis.Client, ttl time.Duration) *RedisTaskStore {
	return &RedisTaskStore{rdb: rdb, ttl: ttl}
}

// Save 保存任务（upsert），TTL 由构造时注入。
func (s *RedisTaskStore) Save(ctx context.Context, task *domaincoderunner.ExecutionTask) error {
	dto := taskToDTO(task)
	body, err := json.Marshal(dto)
	if err != nil {
		return fmt.Errorf("序列化任务失败: %w", err)
	}
	key := taskKeyPrefix + task.ID().String()
	if err := s.rdb.Set(ctx, key, body, s.ttl).Err(); err != nil {
		return domainshared.Internal("保存执行任务失败", err)
	}
	return nil
}

// Get 按 ID 查任务，不存在返回 ErrTaskNotFound。
func (s *RedisTaskStore) Get(ctx context.Context, id domainshared.ID) (*domaincoderunner.ExecutionTask, error) {
	key := taskKeyPrefix + id.String()
	body, err := s.rdb.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return nil, domaincoderunner.ErrTaskNotFound
	}
	if err != nil {
		return nil, domainshared.Internal("读取执行任务失败", err)
	}
	var dto taskDTO
	if err := json.Unmarshal(body, &dto); err != nil {
		return nil, fmt.Errorf("解析执行任务失败: %w", err)
	}
	return taskFromDTO(dto), nil
}

// DeleteExpired 删除过期任务。
//
// Redis 的 TTL 自动过期机制已保证过期 key 被清理，此方法为接口完整性保留。
// 未来若改用 SCAN 主动清理可在此实现。
func (s *RedisTaskStore) DeleteExpired(ctx context.Context) error {
	// Redis TTL 自动过期，无需主动清理
	return nil
}

// taskDTO 任务在 Redis 里的序列化形态（公开字段，绕过 domain 的私有字段）。
type taskDTO struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Language   string `json:"language"`
	Source     string `json:"source"`
	Status     string `json:"status"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	ExitCode   *int   `json:"exit_code,omitempty"`
	DurationMs uint64 `json:"duration_ms"`
	CreatedAt  int64  `json:"created_at"` // unix nano
}

func taskToDTO(task *domaincoderunner.ExecutionTask) taskDTO {
	return taskDTO{
		ID:         task.ID().String(),
		UserID:     task.UserID().String(),
		Language:   task.Language(),
		Source:     task.Source(),
		Status:     task.Status(),
		Stdout:     task.Stdout(),
		Stderr:     task.Stderr(),
		ExitCode:   task.ExitCode(),
		DurationMs: task.DurationMs(),
		CreatedAt:  task.CreatedAt().UnixNano(),
	}
}

func taskFromDTO(dto taskDTO) *domaincoderunner.ExecutionTask {
	id, _ := domainshared.ParseID(dto.ID)
	uid, _ := domainshared.ParseID(dto.UserID)
	createdAt := time.Unix(0, dto.CreatedAt)
	if dto.CreatedAt == 0 {
		createdAt = time.Now()
	}
	return domaincoderunner.ReconstructExecutionTask(
		id, uid, dto.Language, dto.Source, dto.Status,
		dto.Stdout, dto.Stderr, dto.ExitCode, dto.DurationMs, createdAt,
	)
}
