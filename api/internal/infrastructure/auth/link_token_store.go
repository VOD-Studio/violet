package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	authcmd "blog-api/internal/application/auth/command"
)

// ============================================================
// RedisLinkTokenStore OAuth 绑定确认中间态（PRD-0033 T3）
// ============================================================

// linkTokenKeyPrefix link_token payload 存储 key 前缀。
const linkTokenKeyPrefix = "link:"

// attemptsKeyPrefix 密码错误计数 key 前缀（与 payload token 同生命周期）。
const attemptsKeyPrefix = "link:attempts:"

// RedisLinkTokenStore link_token 的 Redis 存储。
//
// payload 与 attempts 分 key：密码错误只 INCR 计数不重写 payload，
// TTL 不会被重置（有效期从 Issue 起算，符合 PRD「超时整个流程重来」）。
type RedisLinkTokenStore struct {
	client *redis.Client
}

// NewRedisLinkTokenStore 创建 link_token 存储。
func NewRedisLinkTokenStore(client *redis.Client) *RedisLinkTokenStore {
	return &RedisLinkTokenStore{client: client}
}

// Issue 签发 ≥256-bit 随机 token 并存储 payload。
func (s *RedisLinkTokenStore) Issue(ctx context.Context, payload *authcmd.LinkTokenPayload, ttl time.Duration) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("生成 link_token 失败: %w", err)
	}
	token := hex.EncodeToString(raw)
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("序列化 link_token payload 失败: %w", err)
	}
	if err := s.client.Set(ctx, linkTokenKeyPrefix+token, data, ttl).Err(); err != nil {
		return "", fmt.Errorf("写入 link_token 失败: %w", err)
	}
	return token, nil
}

// Get 读取 payload（不消费）。不存在返回 redis.Nil，由调用方按 token 无效处理。
func (s *RedisLinkTokenStore) Get(ctx context.Context, token string) (*authcmd.LinkTokenPayload, error) {
	data, err := s.client.Get(ctx, linkTokenKeyPrefix+token).Bytes()
	if err != nil {
		return nil, err
	}
	var payload authcmd.LinkTokenPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("解析 link_token payload 失败: %w", err)
	}
	return &payload, nil
}

// Consume 一次性删除 payload 与计数（幂等）。
func (s *RedisLinkTokenStore) Consume(ctx context.Context, token string) error {
	if err := s.client.Del(ctx, linkTokenKeyPrefix+token, attemptsKeyPrefix+token).Err(); err != nil {
		return fmt.Errorf("删除 link_token 失败: %w", err)
	}
	return nil
}

// IncrAttempts 错误计数 +1；首次计数时以 payload 剩余 TTL 对齐窗口。
func (s *RedisLinkTokenStore) IncrAttempts(ctx context.Context, token string) (int, error) {
	key := attemptsKeyPrefix + token
	n, err := s.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("link_token 错误计数失败: %w", err)
	}
	if n == 1 {
		// 首次计数：TTL 对齐 payload 剩余寿命，避免 payload 过期后计数残留。
		if err := s.client.Expire(ctx, key, s.client.TTL(ctx, linkTokenKeyPrefix+token).Val()).Err(); err != nil {
			return int(n), nil // Expire 失败不影响计数语义
		}
	}
	return int(n), nil
}
