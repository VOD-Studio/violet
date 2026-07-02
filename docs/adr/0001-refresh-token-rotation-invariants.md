# Refresh Token 轮换与吊销的不变量

Status: proposed

## 背景

认证系统采用 HttpOnly Cookie 承载 access/refresh JWT，refresh token 单槽白名单（Redis `refresh:<userID>`）轮换。2026-07 安全审计发现 refresh 路径存在三处偏离标准不变量的缺陷，本 ADR 记录应有不变量与当前实现的差距，作为后续修复的依据。术语见根目录 `CONTEXT.md`。

## 应有不变量

1. **原子轮换**：Verify（旧 token 仍有效）→ Save（写入新 token）必须是单次原子操作，否则并发刷新可让同一个 refresh token 铸出多对 token。
2. **重用即吊销家族**：检测到已被轮换掉的旧 refresh token 再次出现时，必须立即吊销当前家族（删除白名单单槽），迫使用户重新登录——因为重用只可能意味着 token 被窃取。
3. **吊销不可静默失败**：登出 / 改密码 / 重置密码触发吊销时，Redis 写入错误必须被处理，否则会出现"改了密码但旧 token 仍可用"的认证不变量破坏。

## 当前实现的偏离（审计发现）

- **偏离 1（违反不变量 1）**：`RefreshTokenHandler.Handle`（`internal/application/auth/command/auth_commands.go`）的 `Verify` + `Save` 是两次独立 Redis 调用，非原子。同文件的 code store 已用 Lua 脚本（`redis_store.go` 的 `verifyScript`）防竞态，refresh 路径未学。
- **偏离 2（违反不变量 2）**：重放旧 token 时 `Verify` 返回 false → 401，但 handler 不删除当前仍有效的 token，无家族吊销。
- **偏离 3（违反不变量 3）**：改密码（`auth_commands_more.go`）/ 重置密码的 `tokenStore.Delete(...)` 返回值被 `_ =` 丢弃，Redis 抖动时吊销静默失败。

## 决策（待实施）

- 用一个 Lua 脚本把 Verify + 重用检测 + Save 合并为单次原子操作，满足不变量 1 与 2。脚本逻辑：`GET` 当前值 → 与入参比较 → 若匹配则 `SET` 新值（轮换成功）；若入参非空但与存储值不匹配（重用）则 `DEL`（家族吊销）；返回结果码区分成功 / 重用 / 无效。
- 吊销操作（logout / change-password / reset-password）的 `Delete` 错误不再忽略，失败时记日志并视情况返回错误，满足不变量 3。

## Consequences

- 引入 Lua 脚本后，Redis 必须支持 `EVAL`（单机/哨兵/集群均满足，已是 code store 的前提）。
- "重用即吊销家族"会导致：用户在多标签页并发刷新时，若竞态失败，可能被误判为重用而强制登出。这是该不变量固有的用户体验代价，标准实践接受此权衡（安全优先）。
