package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

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
