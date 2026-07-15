# Issue-0003：session 与 cache 基础设施

## Status: ✅ 已完成（commit `9734dde7`）

## Parent

PRD：`../../prd/0009-mimo-music-foundation.md`（Solution 第 3 步）
关联：[架构 ADR 第 5.3/5.2 节、第 6 节](../../adr/mimo-music-architecture.md)

## What to build

统一 session 和 cache 的接口定位（现状散落在 provider 包和 service 包），迁移到新架构位置。

### SessionStore（internal/netease/session/）

接口定位从 `provider/session.go` + `service/session_rotator.go` 统一到 `internal/netease/session/session.go`，签名改为 ADR 第 6 节：

```go
type AuthRequirement int
const (
    AuthAnonymous  AuthRequirement = iota
    AuthLoggedIn
)

type SessionStore interface {
    GetAvailable(ctx context.Context, req AuthRequirement) (*Session, error)
    ReportSuccess(sessionID string)
    ReportFailure(sessionID string, err error)
}
```

实现迁移：
- 从 `service/session_rotator.go` 迁移 round-robin 选取逻辑（atomic.Uint64 counter + 排序 userIDs 取模稳定 + 过滤不可用）。
- `store/redis/session_store.go` → `internal/store/redis/session.go`：保留 `mimo-music:session:{userID}` key 约定。
- `store/redis/availability_store.go` → `internal/store/redis/availability.go`：保留 `mimo-music:session-unavail:{userID}` key + 30min TTL。
- `ReportSuccess`/`ReportFailure` 替代现有的 `MarkAvailable`/`MarkUnavailable`，语义更宽（后续支持健康度统计）。
- 登录类接口（captcha/login/qrcode）是创建新 session 的源头，不走 GetAvailable，直接 Save——这条路径保留现有逻辑。

### Cache（internal/cache/）

消除现有重复定义（provider/cache.go 的 NoopCache 与 cache/noop.go 重复）：

- `internal/cache/cache.go`：Cache 接口定位。签名可优化现状（现状 Get 返回 string，proto 序列化是 []byte 更自然）：

  ```go
  type Cache interface {
      Get(ctx context.Context, key string) ([]byte, bool, error)
      Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
      Delete(ctx context.Context, key string) error
  }
  ```

  TTL 用 `time.Duration` 替代现状的 `int` 秒（Execute 传 `ep.Cache.TTL` 是 Duration）。

- `internal/cache/noop.go`：唯一 NoopCache 实现。
- `internal/cache/redis/cache.go`：从 `cache/redis/cache.go` 迁移，value 改 []byte。

### 接口依赖对齐

0002 的 engine 持有 `SessionStore` + `Cache` 作为字段（依赖倒置）。本 issue 定义这两个接口并实现，0002 的 engine 注入它们。两个 issue 接口对齐后并行推进。

## Acceptance criteria

- [x] `internal/netease/session/session.go` 定义 AuthRequirement enum + SessionStore 接口（GetAvailable/ReportSuccess/ReportFailure）
- [x] SessionStore 实现迁移 round-robin + 可用性过滤，保留现有 key 约定
- [x] ReportSuccess/ReportFailure 替代 MarkAvailable/MarkUnavailable
- [x] 登录类接口的 session 创建路径（不走 GetAvailable）保留
- [x] `internal/cache/cache.go` 定义 Cache 接口（[]byte value + Duration TTL）
- [x] NoopCache 唯一定义（消除重复）
- [x] Redis 实现迁移，value 改 []byte
- [x] session 层单测：round-robin 选取稳定、不可用过滤、全部不可用返回错误
- [x] cache 层单测：Get/Set/Delete + noop
- [x] 所有导出符号有 godoc 注释

## Blocked by

0001 —— 接口定义不依赖 proto，但实现迁移要对齐 engine 的接口预期（与 0002 协调）。
