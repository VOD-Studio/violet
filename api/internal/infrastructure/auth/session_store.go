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

// userSessionsKey 某用户全部 session id 的索引 key（ZSET，score=创建时间毫秒）。
// 改密/重置密码批量吊销、设备列表与并发上限淘汰都经由该索引。
func userSessionsKey(userID string) string { return "user:" + userID + ":sessions" }

// sessionPayload session 在 Redis 中的序列化结构。
//
// lastSeenAt 供聚合根 IsExpired 判断 idle；absoluteDeadline 判断绝对寿命（max
// 配置）。两者都持久化，使 Get 无需外部状态即可判过期；毫秒数值字段供 Lua
// 脚本在不解析 RFC3339 的情况下做过期清理与排序。
type sessionPayload struct {
	// UserID 用户唯一标识
	UserID string `json:"user_id"`
	// Email 用户邮箱
	Email string `json:"email"`
	// Role 角色名
	Role string `json:"role"`
	// IsRoot root 用户标志位
	IsRoot bool `json:"is_root"`
	// CSRFToken CSRF 凭证
	CSRFToken string `json:"csrf_token"`
	// CreatedAt session 创建时间
	CreatedAt time.Time `json:"created_at"`
	// LastSeenAt 最近活跃时间，idle 滑动续期判断基准
	LastSeenAt time.Time `json:"last_seen_at"`
	// AbsoluteDeadline 绝对寿命截止时间，零值表示无上限
	AbsoluteDeadline time.Time `json:"absolute_deadline"`
	// ClientIP 最近一次请求的客户端 IP（设备列表展示）
	ClientIP string `json:"client_ip,omitempty"`
	// ClientUserAgent 最近一次请求的 User-Agent（已截断）
	ClientUserAgent string `json:"client_ua,omitempty"`
	// CreatedMS 创建时间毫秒，ZSET score 与 Lua 迁移用
	CreatedMS int64 `json:"created_ms,omitempty"`
	// AbsDeadlineMS 绝对截止毫秒，0 表示无上限；Lua 清理僵尸索引用
	AbsDeadlineMS int64 `json:"abs_ms,omitempty"`
}

// createBoundedScript 原子执行「清理过期索引 → 按上限淘汰最旧 → 写入新会话」。
//
// KEYS[1]=用户索引 ZSET；ARGV: 1=session key、2=新成员 id、3=payload JSON、
// 4=idle TTL 秒、5=创建毫秒 score、6=并发上限（0 不限）、7=当前毫秒。
// 返回被淘汰的 session id 列表（Lua 数组，无淘汰时为空）。
var createBoundedScript = redis.NewScript(`
local idx = KEYS[1]
local skey = ARGV[1]
local member = ARGV[2]
local ttl = tonumber(ARGV[4])
local limit = tonumber(ARGV[6])
local now = tonumber(ARGV[7])

local members = redis.call('ZRANGE', idx, 0, -1)
local alive = {}
for _, m in ipairs(members) do
	local pk = 'session:' .. m
	if redis.call('EXISTS', pk) == 1 then
		local dead = false
		local payload = redis.call('GET', pk)
		if payload then
			local ok, obj = pcall(cjson.decode, payload)
			if ok and obj then
				local absms = tonumber(obj['abs_ms'])
				if absms and absms > 0 and absms < now then
					dead = true
				end
			end
		end
		if dead then
			redis.call('DEL', pk)
			redis.call('ZREM', idx, m)
		else
			alive[#alive + 1] = m
		end
	else
		redis.call('ZREM', idx, m)
	end
end

local evicted = {}
if limit > 0 and #alive >= limit then
	local count = #alive - limit + 1
	for i = 1, count do
		redis.call('DEL', 'session:' .. alive[i])
		redis.call('ZREM', idx, alive[i])
		evicted[#evicted + 1] = alive[i]
	end
end

local absms = tonumber(ARGV[8]) or 0
if absms > 0 then
	local remain = math.floor((absms - now) / 1000)
	if remain < ttl then
		ttl = remain
	end
end
if ttl < 1 then
	ttl = 1
end
redis.call('SET', skey, ARGV[3], 'EX', ttl)
redis.call('ZADD', idx, tonumber(ARGV[5]), member)
redis.call('EXPIRE', idx, tonumber(ARGV[4]))
return evicted
`)

// touchScript 仅在 session key 仍存在时续期，防止「并发吊销 → 迟到 Touch」
// 用无条件 SET 复活已吊销的凭据。TTL 取 min(idle, 绝对寿命剩余)，使 Redis
// 键存活期与鉴权语义一致（绝对过期后键自动消失，统计与索引不虚高）。
//
// KEYS[1]=session key、KEYS[2]=用户索引；ARGV: 1=payload JSON、2=idle TTL 秒、
// 3=绝对截止毫秒（0 无上限）、4=当前毫秒。
var touchScript = redis.NewScript(`
if redis.call('EXISTS', KEYS[1]) == 0 then
	return 0
end
local ttl = tonumber(ARGV[2])
local absms = tonumber(ARGV[3]) or 0
if absms > 0 then
	local remain = math.floor((absms - tonumber(ARGV[4])) / 1000)
	if remain < ttl then
		ttl = remain
	end
end
if ttl < 1 then
	ttl = 1
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ttl)
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
return 1
`)

// RedisSessionStore 基于 go-redis 的 SessionStore 实现。
//
// 维护两类 key：
//   - session:<id>：单个 session 的 payload，TTL=idleTTL，滑动续期时重置
//   - user:<uid>:sessions：某用户全部 session id 的 ZSET（score=创建毫秒），
//     支撑批量吊销、设备列表与并发上限淘汰
type RedisSessionStore struct {
	// rdb Redis 客户端，存 session:<id> 与 user:<uid>:sessions 两类 key
	rdb *redis.Client
}

// NewRedisSessionStore 构造 Redis session store。
func NewRedisSessionStore(rdb *redis.Client) *RedisSessionStore {
	return &RedisSessionStore{rdb: rdb}
}

// Create 写入 session payload + 登记用户索引，TTL=idleTTL，不限并发数。
func (s *RedisSessionStore) Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error {
	_, err := s.CreateBounded(ctx, sess, idleTTL, 0)
	return err
}

// CreateBounded 在并发上限约束下原子创建 session：先清理已过期索引成员，
// 再按创建时间淘汰最旧有效会话给新会话腾位，最后写入新 payload 与索引。
// maxDevices<=0 表示不限制。返回被淘汰的 session id。
func (s *RedisSessionStore) CreateBounded(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration, maxDevices int) ([]string, error) {
	payload := toPayload(sess)
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal session: %w", err)
	}
	ttlSeconds := int(idleTTL.Seconds())
	if ttlSeconds < 1 {
		ttlSeconds = 1
	}
	evicted, err := createBoundedScript.Run(ctx, s.rdb,
		[]string{userSessionsKey(sess.UserID())},
		sessionKey(sess.ID()), string(sess.ID()), data,
		ttlSeconds, payload.CreatedMS, maxDevices, time.Now().UnixMilli(), payload.AbsDeadlineMS,
	).StringSlice()
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return evicted, nil
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

// Touch 滑动续期：仅当 session key 仍存在时更新 payload 并重置 TTL，
// 已被并发吊销的 session 不会被复活。不换 id（命门不变量②），不产生 Set-Cookie。
func (s *RedisSessionStore) Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration, client domainsession.ClientContext) error {
	sess.Touch(time.Now(), client)
	payload := toPayload(sess)
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal session on touch: %w", err)
	}
	touched, err := touchScript.Run(ctx, s.rdb,
		[]string{sessionKey(sess.ID()), userSessionsKey(sess.UserID())},
		data, int(idleTTL.Seconds()), payload.AbsDeadlineMS, time.Now().UnixMilli(),
	).Int()
	if err != nil {
		return fmt.Errorf("touch session: %w", err)
	}
	if touched == 0 {
		return domainsession.ErrSessionNotFound
	}
	return nil
}

// DeleteForUser 删除指定用户的指定 session（登出/设备吊销），同步 ZREM 索引。
func (s *RedisSessionStore) DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error {
	pipe := s.rdb.TxPipeline()
	pipe.Del(ctx, sessionKey(id))
	pipe.ZRem(ctx, userSessionsKey(userID), string(id))
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("delete session for user: %w", err)
	}
	return nil
}

// DeleteByUser 删除某用户全部 session（改密/重置密码/撤权强制全部设备重登）。
func (s *RedisSessionStore) DeleteByUser(ctx context.Context, userID string) error {
	idx := userSessionsKey(userID)
	ids, err := s.rdb.ZRange(ctx, idx, 0, -1).Result()
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

// ListByUser 返回该用户全部仍存活（payload 存在且未过绝对寿命）的 session，
// 按创建时间升序。供设备列表与吊销前的属主校验使用；不返回任何凭据语义
// 之外的字段。
func (s *RedisSessionStore) ListByUser(ctx context.Context, userID string) ([]*domainsession.Session, error) {
	idx := userSessionsKey(userID)
	ids, err := s.rdb.ZRange(ctx, idx, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("list user session ids: %w", err)
	}
	if len(ids) == 0 {
		return nil, nil
	}
	payloads, err := s.rdb.MGet(ctx, sessionKeys(ids)...).Result()
	if err != nil {
		return nil, fmt.Errorf("mget user sessions: %w", err)
	}
	now := time.Now()
	sessions := make([]*domainsession.Session, 0, len(ids))
	for i, raw := range payloads {
		if raw == nil {
			continue
		}
		data, ok := raw.(string)
		if !ok {
			continue
		}
		var p sessionPayload
		if err := json.Unmarshal([]byte(data), &p); err != nil {
			continue
		}
		sess := fromPayload(domainsession.ID(ids[i]), p)
		if p.AbsDeadlineMS > 0 && now.UnixMilli() >= p.AbsDeadlineMS {
			continue
		}
		sessions = append(sessions, sess)
	}
	return sessions, nil
}

// MigrateLegacyIndexes 将升级前部署的 SET 用户索引转换为 ZSET，并为旧版
// payload（只有 created_at/absolute_deadline，无 created_ms/abs_ms 数值字段）
// 补写排序与过期信息：score 从 created_at 恢复，abs_ms 从 absolute_deadline
// 恢复——否则旧会话按 score=0 随机序淘汰、绝对寿命到期仍占名额。
// 幂等：已是 ZSET 的索引原样跳过；启动单次调用，无并发写竞争。
func (s *RedisSessionStore) MigrateLegacyIndexes(ctx context.Context, idleTTL time.Duration) error {
	var cursor uint64
	for {
		keys, next, err := s.rdb.Scan(ctx, cursor, "user:*:sessions", 100).Result()
		if err != nil {
			return fmt.Errorf("scan session indexes: %w", err)
		}
		for _, key := range keys {
			if err := s.migrateLegacyIndex(ctx, key, idleTTL); err != nil {
				return fmt.Errorf("migrate index %s: %w", key, err)
			}
		}
		if next == 0 {
			return nil
		}
		cursor = next
	}
}

func (s *RedisSessionStore) migrateLegacyIndex(ctx context.Context, idx string, idleTTL time.Duration) error {
	kind, err := s.rdb.Type(ctx, idx).Result()
	if err != nil || kind != "set" {
		return err
	}
	members, err := s.rdb.SMembers(ctx, idx).Result()
	if err != nil {
		return err
	}
	// 逐成员补写数值字段并按 min(idle, 绝对剩余) 校正 TTL；
	// 同时收集 member→score（created_ms）供类型切换。
	args := make([]any, 0, len(members)*2+1)
	args = append(args, int(idleTTL.Seconds()))
	for _, member := range members {
		key := "session:" + member
		score := int64(0)
		data, err := s.rdb.Get(ctx, key).Bytes()
		if err == nil {
			var payload sessionPayload
			if json.Unmarshal(data, &payload) == nil {
				if payload.CreatedMS == 0 && !payload.CreatedAt.IsZero() {
					payload.CreatedMS = payload.CreatedAt.UnixMilli()
				}
				if payload.AbsDeadlineMS == 0 && !payload.AbsoluteDeadline.IsZero() {
					payload.AbsDeadlineMS = payload.AbsoluteDeadline.UnixMilli()
				}
				score = payload.CreatedMS
				if updated, err := json.Marshal(payload); err == nil {
					// PTTL 毫秒精度：<=0 表示 key 已删除（-2）或亚毫秒到期——
					// 重写会复活/延长它，跳过；-1（无过期）收紧为 idleTTL。
					pttl, err := s.rdb.PTTL(ctx, key).Result()
					if err != nil {
						return err
					}
					if pttl > 0 {
						ttl := idleTTL
						if remain := pttl + time.Second; remain < ttl {
							ttl = remain // 向上取整 1s，绝不短于剩余寿命
						}
						if payload.AbsDeadlineMS > 0 {
							if remain := time.Until(time.UnixMilli(payload.AbsDeadlineMS)); remain > 0 && remain < ttl {
								ttl = remain
							}
						}
						if err := s.rdb.Set(ctx, key, updated, ttl).Err(); err != nil {
							return err
						}
					}
				}
			}
		} else if err != redis.Nil {
			return err
		}
		args = append(args, member, score)
	}
	// 同名 key 类型互斥：经临时 key 原子完成 SET→ZSET 切换，score 由
	// ARGV 成对传入（ARGV[1]=索引 TTL，其后 member、score 交替）。
	return redis.NewScript(`
if redis.call('TYPE', KEYS[1])['ok'] ~= 'set' then return 0 end
redis.call('RENAME', KEYS[1], KEYS[2])
local ttl = tonumber(ARGV[1])
for i = 2, #ARGV, 2 do
	redis.call('ZADD', KEYS[1], tonumber(ARGV[i + 1]), ARGV[i])
end
redis.call('EXPIRE', KEYS[1], ttl)
redis.call('DEL', KEYS[2])
return 1
`).Run(ctx, s.rdb, []string{idx, idx + ":legacy"}, args...).Err()
}

// CountActiveSessions 统计当前存活 session 数（SCAN 渐进，管理监控用）。
func (s *RedisSessionStore) CountActiveSessions(ctx context.Context) (int64, error) {
	var cursor uint64
	var total int64
	for {
		keys, next, err := s.rdb.Scan(ctx, cursor, "session:*", 100).Result()
		if err != nil {
			return 0, fmt.Errorf("scan sessions: %w", err)
		}
		total += int64(len(keys))
		if next == 0 {
			return total, nil
		}
		cursor = next
	}
}

// CountActiveUsers 统计至少持有一个存活会话的用户数。
// 以 session:* payload 的 user_id 去重为准：索引键 TTL 按滑动窗口刷新，
// 会话本体可能因绝对寿命提前消失，按索引键计数会长期高估。
func (s *RedisSessionStore) CountActiveUsers(ctx context.Context) (int64, error) {
	users := make(map[string]struct{})
	var cursor uint64
	for {
		keys, next, err := s.rdb.Scan(ctx, cursor, "session:*", 100).Result()
		if err != nil {
			return 0, fmt.Errorf("scan sessions for users: %w", err)
		}
		for i := 0; i < len(keys); i += 50 {
			batch := keys[i:min(i+50, len(keys))]
			payloads, err := s.rdb.MGet(ctx, batch...).Result()
			if err != nil {
				return 0, fmt.Errorf("mget sessions for users: %w", err)
			}
			for _, raw := range payloads {
				data, ok := raw.(string)
				if !ok {
					continue
				}
				var payload sessionPayload
				if json.Unmarshal([]byte(data), &payload) == nil && payload.UserID != "" {
					users[payload.UserID] = struct{}{}
				}
			}
		}
		if next == 0 {
			return int64(len(users)), nil
		}
		cursor = next
	}
}

func sessionKeys(ids []string) []string {
	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = "session:" + id
	}
	return keys
}

// toPayload 从 session 聚合提取可序列化结构。
func toPayload(sess *domainsession.Session) sessionPayload {
	deadline := sess.AbsoluteDeadline()
	var absMS int64
	if !deadline.IsZero() {
		absMS = deadline.UnixMilli()
	}
	client := sess.Client()
	return sessionPayload{
		UserID:           sess.UserID(),
		Email:            sess.Claims().Email,
		Role:             sess.Claims().Role,
		IsRoot:           sess.Claims().IsRoot,
		CSRFToken:        sess.Claims().CSRFToken,
		CreatedAt:        sess.CreatedAt(),
		LastSeenAt:       sess.LastSeenAt(),
		AbsoluteDeadline: deadline,
		ClientIP:         client.IP,
		ClientUserAgent:  client.UserAgent,
		CreatedMS:        sess.CreatedAt().UnixMilli(),
		AbsDeadlineMS:    absMS,
	}
}

// fromPayload 从序列化结构重建 session 聚合。旧版本 payload（无 client 字段）
// 反序列化为零值 ClientContext，行为不变。
func fromPayload(id domainsession.ID, p sessionPayload) *domainsession.Session {
	return domainsession.Reconstruct(
		id, p.UserID, p.Email, p.Role, p.IsRoot,
		domainsession.CSRFToken(p.CSRFToken), p.CreatedAt, p.LastSeenAt, p.AbsoluteDeadline,
		domainsession.ClientContext{IP: p.ClientIP, UserAgent: p.ClientUserAgent},
	)
}
