package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	domainsession "blog-api/internal/domain/session"
)

// sessionKey 单个 session 的 Redis key。
func sessionKey(id domainsession.ID) string { return "session:" + string(id) }

// userSessionsKey 某用户全部 session id 的集合 key。
// 改密/重置密码时用 SMEMBERS 取出全部 id 批量删除，强制该用户所有设备重登。
func userSessionsKey(userID string) string { return "user:" + userID + ":sessions" }

// sessionPayload session 在 Redis 中的序列化结构。
//
// lastSeenAt 供聚合根 IsExpired 判断 idle；absoluteDeadline 判断绝对寿命（max
// 配置）。两者都持久化，使 Get 无需外部状态即可判过期。
type sessionPayload struct {
	UserID              string    `json:"user_id"`
	Email               string    `json:"email"`
	Role                string    `json:"role"`
	RoleID              int32     `json:"role_id"`
	IsBuiltinSuperAdmin bool      `json:"is_builtin_super_admin"`
	CSRFToken           string    `json:"csrf_token"`
	CreatedAt           time.Time `json:"created_at"`
	LastSeenAt          time.Time `json:"last_seen_at"`
	AbsoluteDeadline    time.Time `json:"absolute_deadline"`
}

// RedisSessionStore 基于 go-redis 的 SessionStore 实现。
//
// 维护两类 key：
//   - session:<id>：单个 session 的 payload，TTL=idleTTL，滑动续期时重置
//   - user:<uid>:sessions：某用户全部 session id 的集合，支撑 DeleteByUser 批量吊销
type RedisSessionStore struct {
	rdb *redis.Client
}

// NewRedisSessionStore 构造 Redis session store。
func NewRedisSessionStore(rdb *redis.Client) *RedisSessionStore {
	return &RedisSessionStore{rdb: rdb}
}

// Create 写入 session payload + 登记用户索引，TTL=idleTTL。
// 用 TxPipeline 保证 session 与索引原子可见。
func (s *RedisSessionStore) Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error {
	payload := toPayload(sess)
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal session: %w", err)
	}
	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, sessionKey(sess.ID()), data, idleTTL)
	pipe.SAdd(ctx, userSessionsKey(sess.UserID()), string(sess.ID()))
	pipe.Expire(ctx, userSessionsKey(sess.UserID()), idleTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("create session: %w", err)
	}
	return nil
}

// Get 读取并反序列化 session，不续期（续期由鉴权中间件显式调 Touch）。
// key 不存在返回 ErrSessionNotFound，调用方映射为 401。
func (s *RedisSessionStore) Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error) {
	data, err := s.rdb.Get(ctx, sessionKey(id)).Bytes()
	if err == redis.Nil {
		return nil, domainsession.ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get session: %w", err)
	}
	var p sessionPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal session: %w", err)
	}
	return fromPayload(id, p), nil
}

// Touch 滑动续期：重置 session key TTL + 更新 lastSeenAt + 重置索引 TTL。
// 不换 id（命门不变量②），不产生 Set-Cookie。
func (s *RedisSessionStore) Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error {
	sess.Touch(time.Now())
	payload := toPayload(sess)
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal session on touch: %w", err)
	}
	pipe := s.rdb.TxPipeline()
	pipe.Set(ctx, sessionKey(sess.ID()), data, idleTTL)
	pipe.Expire(ctx, userSessionsKey(sess.UserID()), idleTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	return nil
}

// DeleteForUser 删除指定用户的指定 session（登出当前设备），同步 SREM 索引。
func (s *RedisSessionStore) DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error {
	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx, sessionKey(id))
	pipe.SRem(ctx, userSessionsKey(userID), string(id))
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete session for user: %w", err)
	}
	return nil
}

// DeleteByUser 删除某用户全部 session（改密/重置密码强制全部设备重登）。
// SMEMBERS 取索引 → 批量 DEL session → DEL 索引。
func (s *RedisSessionStore) DeleteByUser(ctx context.Context, userID string) error {
	idx := userSessionsKey(userID)
	ids, err := s.rdb.SMembers(ctx, idx).Result()
	if err != nil {
		return fmt.Errorf("list user sessions: %w", err)
	}
	if len(ids) == 0 {
		return nil
	}
	pipe := s.rdb.TxPipeline()
	for _, id := range ids {
		pipe.Del(ctx, sessionKey(domainsession.ID(id)))
	}
	pipe.Del(ctx, idx)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete user sessions: %w", err)
	}
	return nil
}

// toPayload 从 session 聚合提取可序列化结构。
func toPayload(sess *domainsession.Session) sessionPayload {
	claims := sess.Claims()
	return sessionPayload{
		UserID:              sess.UserID(),
		Email:               claims.Email,
		Role:                claims.Role,
		RoleID:              claims.RoleID,
		IsBuiltinSuperAdmin: claims.IsBuiltinSuperAdmin,
		CSRFToken:           claims.CSRFToken,
		CreatedAt:           sess.CreatedAt(),
		LastSeenAt:          sess.LastSeenAt(),
		AbsoluteDeadline:    sess.AbsoluteDeadline(),
	}
}

// fromPayload 从序列化结构重建 session 聚合。
func fromPayload(id domainsession.ID, p sessionPayload) *domainsession.Session {
	return domainsession.Reconstruct(
		id, p.UserID, p.Email, p.Role, p.RoleID, p.IsBuiltinSuperAdmin,
		domainsession.CSRFToken(p.CSRFToken), p.CreatedAt, p.LastSeenAt, p.AbsoluteDeadline,
	)
}
