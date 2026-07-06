# Issue-0009：后端 session 基础设施（聚合根 + Store + 中间件）

## Parent

PRD-0002（`docs/prd/0002-登录态opaque-session重构.md`）

## What to build

搭建 opaque session 的后端基础设施三件套，为后续登录链路改造提供契约。这是整个重构的地基，命门不变量在此确立。

- `domain/session` 聚合根：opaque ID（32 字节 base64url）+ CSRFToken + 滑动 idle 过期 + 可选绝对 max 寿命 + Touch 不轮换 id
- `SessionStore` 端口（application/shared）+ Redis 实现：Create / Get / Touch / DeleteForUser / DeleteByUser，维护 `session:<id>` 与 `user:<uid>:sessions` 索引
- `SessionAuth` / `OptionalSessionAuth` 鉴权中间件：读 mimo_session cookie → 查 session → 注入 ctx（复用现有 context key）→ Touch 滑动续期，不轮换 id、不 Set-Cookie

本 issue 不碰登录 handler、不删 JWT（JWT 与 session 在 Issue-0012 之前共存以保证编译）。

## Acceptance criteria

### Session 聚合根（domain/session）
- [ ] `entity.go`：Session 聚合根，字段 id / userID / email / role / roleID / isBuiltinSuperAdmin / csrf / createdAt / lastSeenAt / absoluteDeadline
- [ ] `NewSession(snap, now, maxTTL)`：maxTTL<=0 无绝对寿命；生成唯一 id + 独立 csrf
- [ ] `Reconstruct(...)`：从 Redis 反序列化重建
- [ ] `IsExpired(now, idleTTL)`：idle 超时 或 absoluteDeadline（非零）已到 → true
- [ ] `Touch(now)`：更新 lastSeenAt，**不改 id**（命门不变量②）
- [ ] `Claims()` 返回鉴权所需字段
- [ ] `entity_test.go`：覆盖 NewSession 唯一性、IsExpired 三态（idle 内 / 超 idle / 到绝对寿命）、Touch 不轮换 id

### SessionStore（application/shared + infrastructure/auth）
- [ ] ports.go 新增 `SessionStore` interface：Create / Get / Touch / DeleteForUser / DeleteByUser（TokenService / TokenStore 暂保留，Issue-0012 删）
- [ ] `RedisSessionStore`：Create 用 TxPipeline（SET session:<id> + SADD user:<uid>:sessions + Expire）；Get 反序列化不续期；Touch 重置 TTL + 更新 lastSeenAt 不换 id；DeleteForUser 删单个 + SREM；DeleteByUser SMEMBERS + 批量 DEL
- [ ] `session_store_test.go`（miniredis）：Create/Get 往返、Get 缺失返回 ErrSessionNotFound、TTL 过期失效、DeleteByUser 清空该用户全部 session

### SessionAuth 中间件（middleware）
- [ ] `SessionLookup` 端口（Get / Touch），RedisSessionStore 实现之
- [ ] `SessionAuth(lookup, cookieCfg, idleTTL)`：缺 / 失效 cookie → 401；成功 → 注入 UserIDKey 等 + Touch
- [ ] `OptionalSessionAuth`：无 cookie 放行不注入（评论双轨用）；失效 cookie 401
- [ ] `authenticateSession(..., touch bool)` 支持「只读不续期」变体（供 /auth/session，Issue-0011 用）
- [ ] 命门：成功路径只 Touch，不轮换 id、不 Set-Cookie
- [ ] `session_auth_test.go`（fakeLookup）：有效 cookie 授权、缺 cookie 401、Optional 无 cookie 放行

### config 预备
- [ ] config.go 新增 `SessionConfig{IdleTTL, MaxTTL}` 与 `CookieConfig.SessionName`（默认 mimo_session），保留 JWT 字段到 Issue-0012 删

## Blocked by

None - 可立即开始。
