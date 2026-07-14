# Issue-0001：Redis 接入与共享连接

## Parent

PRD：`../../prd/0006-mimo-music-phase-2.md`（user stories 1-2、11；Implementation Decisions - Redis 接入）

## What to build

建 `internal/infra/redis/` 共享 Redis 客户端，cache、store、Asynq 共用同一连接池。server 和 worker 的 main.go 启动时初始化 Redis 连接，注入 `cache/redis` 和 `store/redis`，替换 Phase 1 的 NoopCache / NoopSessionStore。这是 Phase 2 的地基切片——缓存和 session 真正落盘后，后续 Cookie 提取、轮换、装饰器才能基于持久状态工作。用 miniredis 写集成测试，覆盖读写、过期、重启后缓存不丢。

## Acceptance criteria

- [ ] `internal/infra/redis/redis.go`：共享 Redis 客户端构造（读 config、连接池参数、ping 健康检查）
- [ ] server main.go 启动时初始化 Redis，注入 `cache/redis` 和 `store/redis`
- [ ] worker main.go 启动时初始化 Redis（与 server 共享同一构造逻辑）
- [ ] `cache/redis` 替换 NoopCache，`store/redis` 替换 NoopSessionStore，Phase 1 代码无业务改动
- [ ] miniredis 集成测试：写入后读取命中、TTL 过期后未命中
- [ ] 重启验证：写缓存 → 重启进程 → 缓存仍命中（miniredis 不可跨进程，用真实 Redis 容器或手测）
- [ ] config 增加 Redis 连接配置项（addr / password / db / pool size）
- [ ] 所有导出符号有 godoc 注释

## Blocked by

无 —— Phase 1 已完成，可立即开始。是 Phase 2 的地基切片。
