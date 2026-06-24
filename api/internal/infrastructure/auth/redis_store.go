package auth

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ============================================================
// RedisTokenStore Refresh Token 存储
// ============================================================

// RedisTokenStore refresh token 的 Redis 存储
//
// Key 格式: refresh:<userID>，Value: refresh token 字符串，TTL: 配置的 refresh TTL。
//
// 用途：登录时存储、刷新时比对、登出/改密时删除（实现服务端撤销）。
type RedisTokenStore struct {
	client *redis.Client
	ttl    time.Duration
}

// NewRedisTokenStore 创建 refresh token 存储
func NewRedisTokenStore(client *redis.Client, ttl time.Duration) *RedisTokenStore {
	return &RedisTokenStore{client: client, ttl: ttl}
}

// Save 存储 refresh token（登录/刷新时调用）
func (s *RedisTokenStore) Save(ctx context.Context, userID, refreshToken string) error {
	key := s.refreshKey(userID)
	if err := s.client.Set(ctx, key, refreshToken, s.ttl).Err(); err != nil {
		return fmt.Errorf("存储 refresh token 失败: %w", err)
	}
	return nil
}

// Verify 比对存储的 refresh token 是否匹配（刷新时调用）
//
// 返回 (匹配?, error)。Redis 中不存在或值不匹配都返回 false（不报错）。
// 使用 crypto/subtle.ConstantTimeCompare 防时序侧信道。
func (s *RedisTokenStore) Verify(ctx context.Context, userID, refreshToken string) (bool, error) {
	key := s.refreshKey(userID)
	stored, err := s.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil // 不存在视为不匹配
		}
		return false, fmt.Errorf("查询 refresh token 失败: %w", err)
	}
	return subtle.ConstantTimeCompare([]byte(stored), []byte(refreshToken)) == 1, nil
}

// Delete 删除 refresh token（登出/改密时调用，实现服务端撤销）
func (s *RedisTokenStore) Delete(ctx context.Context, userID string) error {
	key := s.refreshKey(userID)
	if err := s.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("删除 refresh token 失败: %w", err)
	}
	return nil
}

func (s *RedisTokenStore) refreshKey(userID string) string {
	return "refresh:" + userID
}

// ============================================================
// RedisCodeStore 验证码存储（邮箱验证 / 密码重置）
// ============================================================

// VerificationData 验证码存储结构（与旧 auth_types.go 兼容）
type VerificationData struct {
	CodeHash string `json:"code_hash"` // SHA256 哈希，非明文
	Attempts int    `json:"attempts"`  // 已尝试次数
}

// RedisCodeStore 验证码的 Redis 存储
//
// 支持两类验证码：
//   - 邮箱验证注册: key "verify:<email>"
//   - 密码重置: key "reset:<email>"
//
// 安全设计：
//   - 验证码以 SHA256 哈希存储（非明文）
//   - 最多 5 次尝试，超限自动删除
//   - TTL 10 分钟
type RedisCodeStore struct {
	client     *redis.Client
	ttl        time.Duration
	maxAttempt int
}

// NewRedisCodeStore 创建验证码存储
func NewRedisCodeStore(client *redis.Client) *RedisCodeStore {
	return &RedisCodeStore{
		client:     client,
		ttl:        10 * time.Minute,
		maxAttempt: 5,
	}
}

// Store 存储验证码（哈希后）
// 显式序列化为 JSON，确保 Lua 脚本能用 cjson.decode 读取（go-redis 不自动序列化结构体）。
func (s *RedisCodeStore) Store(ctx context.Context, prefix, identifier string, codeHash string) error {
	key := s.codeKey(prefix, identifier)
	data := VerificationData{CodeHash: codeHash, Attempts: 0}
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化验证码失败: %w", err)
	}
	return s.client.Set(ctx, key, payload, s.ttl).Err()
}

// verifyScript 原子验证验证码，防并发暴力破解。
//
// 单次 Lua 执行内完成：GET → 比对 code_hash → 匹配则 DEL / 不匹配则 attempts+1 / 超限则 DEL。
// ARGV: [1]=期望 codeHash [2]=maxAttempt [3]=ttl(秒)
// 返回数组: {[1]=匹配标志 0/1, [2]=当前尝试次数}
//
// 注：code_hash 比对在 Lua 内做字符串相等（Redis 单线程，Lua 内无并发竞态），
// 时序侧信道在此场景不适用（验证码本身是高熵哈希，非长期密钥）。
var verifyScript = redis.NewScript(`
local data = redis.call('GET', KEYS[1])
if not data then
  return {0, -1}
end
local obj = cjson.decode(data)
local attempts = tonumber(obj['attempts']) or 0
local max = tonumber(ARGV[2])
if attempts >= max then
  redis.call('DEL', KEYS[1])
  return {0, attempts}
end
if obj['code_hash'] == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return {1, attempts}
end
attempts = attempts + 1
obj['attempts'] = attempts
redis.call('SET', KEYS[1], cjson.encode(obj), 'EX', tonumber(ARGV[3]))
return {0, attempts}
`)

// Verify 验证并消费验证码（原子操作，防并发暴力破解）
//
// 返回 (匹配?, error)。
// - 匹配成功: 删除 key（一次性）
// - 尝试次数超限: 删除 key 并返回 false
// - 不匹配: 尝试次数 +1
func (s *RedisCodeStore) Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error) {
	key := s.codeKey(prefix, identifier)
	res, err := verifyScript.Run(ctx, s.client, []string{key}, codeHash, s.maxAttempt, int64(s.ttl.Seconds())).Result()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, fmt.Errorf("验证码校验失败: %w", err)
	}
	vals, ok := res.([]interface{})
	if !ok || len(vals) < 1 {
		return false, nil
	}
	matched, ok := vals[0].(int64)
	return ok && matched == 1, nil
}

func (s *RedisCodeStore) codeKey(prefix, identifier string) string {
	return prefix + ":" + identifier
}

// MaxAttempt 返回最大尝试次数
func (s *RedisCodeStore) MaxAttempt() int { return s.maxAttempt }
