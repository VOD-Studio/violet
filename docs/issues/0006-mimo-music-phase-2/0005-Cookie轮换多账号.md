# Issue-0005：Cookie 轮换多账号

## Parent

PRD：`../../prd/0006-mimo-music-phase-2.md`（user story 12；Implementation Decisions - Cookie 轮换）

## What to build

store 支持 session 列表 + 轮换策略（round-robin），不再只持单个 Cookie。service 调用解析接口时按轮换策略从 store 取下一个可用 Cookie 注入 provider，遇到失效自动标记跳过。worker 健康检查把失效 session 标记为 unavailable，轮换时直接跳过。这是多账号容错的基础——单个账号被封或过期时，服务自动切到下一个，不影响博客播放。

## Acceptance criteria

- [ ] store 支持 session 列表存储 + round-robin 轮换策略（线程安全）
- [ ] service 取 Cookie 时按轮换选下一个可用 session，注入 provider
- [ ] provider 返回 Cookie 失效错误时，service 标记该 session 为 unavailable 并跳过
- [ ] worker 健康检查把失效 session 标记 unavailable，有效则恢复 available
- [ ] 所有 session 失效时返回明确错误（而非无限轮换）
- [ ] 轮换逻辑测试：多 session 依次轮换、失效跳过、恢复后重新纳入
- [ ] 轮换计数 / 可用 session 数指标（可选，依赖 Issue-0003）
- [ ] 所有导出符号有 godoc 注释

## Blocked by

- Issue-0001（Redis 接入，session 列表需持久化）
- Issue-0002（Cookie 提取，多账号需登录写入真实 Cookie）
