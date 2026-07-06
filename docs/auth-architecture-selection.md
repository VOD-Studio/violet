# 认证架构选型：从 JWT access/refresh 到 opaque session

> 本文档记录 mimo-blog 登录态架构重做的方案选型过程、候选方案对比、决策演进与最终选择。配套决策记录见 `docs/adr/0003-login-opaque-session.md`，术语见根目录 `CONTEXT.md` 认证章节。

## 1. 背景：为什么要重做登录态

当前登录态基于 access/refresh JWT + HttpOnly cookie（ADR-0001、ADR-0002），实践中暴露三类问题：

1. **SSR 持续掉登录，根因未根治**：TanStack Start server function 以 JSON-over-fetch 返回，`Set-Cookie` 不透传浏览器；SSR 调 `/auth/me` 触发 refresh，浏览器永远收不到新 cookie（详见 `docs/ssr-auth-refactor-handoff.md`）。
2. **补丁堆叠**：为缓解掉登录与 401 风暴，前端叠加 `authGate`（401 挂起重放）、`refresh-queue`（跨 tab 互斥）、`AuthDebugPanel`、主动刷新定时器、双链重放，复杂且脆弱。
3. **JWT 无状态收益是幻觉**：refresh token 已用 Redis 白名单——单槽 + 轮换 + 家族重用检测，并非纯无状态；每次 refresh 多次 Redis 操作。"省一次查询"的性能优势对单后端、博客级流量无意义。

历史尝试均未根治：ADR-0001 补了 rotation 不变量，治标；ADR-0002 规划了 SSR 直验 JWT，从未实施且仍要客户端 refresh；handoff 文档要求"先验证 request middleware 能否透传 Set-Cookie"，这一步从未执行。

## 2. 候选方案对比

| 维度 | A. 保留 JWT 修 SSR 透传 | B. 纯 opaque session ✅ | C. opaque + JWT 混合 | D. 引入 better-auth |
|---|---|---|---|---|
| 绕开 SSR Set-Cookie 透传卡点 | 否，必须先解决透传 | **是，SSR 只读不写** | 否，refresh 换 JWT 重新撞透传 | 可能，框架内置 |
| 复杂度 | 高（jose + 公钥 + refresh + rotation） | **低（一次 Redis GET）** | 高（两套机制并存） | 中（第三方适配层） |
| 可即时吊销 | 否，需黑名单 | **是，删 Redis key** | 部分 | 是 |
| 鉴权成本 | 验签零查询 | Redis GET，微秒级 | JWT 期内免查 | 取决于实现 |
| 迁移成本 | 中 | **低，强制重登无兼容层** | 高 | 高 |
| 业界对标 | Auth.js / Supabase（但它们靠 middleware 透传） | bilibili / GitHub / Discord / Google | 少见 | better-auth 生态 |

## 3. 选型演进（决策链）

按时间顺序记录这次选型的关键转折：

1. **起点**：要求"完全推翻登录，cookie 用法不正确，参考 supabase/bilibili"。
2. **根因定位**：代码与文档证据显示，掉登录的全部根因是 TanStack Start `Set-Cookie` 透传单点卡点；后端 token 模型本身是专业的（rotation / reuse-detection / double-submit CSRF）。"完全推翻"是过度反应。
3. **方向确认**：坚持重做但保留 TanStack Start + Go 栈。关键认知：不换框架 = 透传约束仍在，任何新设计都必须回答"SSR 要不要刷新会话"。
4. **会话模型**：选 opaque session（bilibili SESSDATA 式）。决定性理由——opaque session 让 SSR 只读 cookie 判登录、不刷新、不写 cookie，**物理上绕开透传卡点**；JWT 模型因 access 短命必然要 refresh、必然撞透传。
5. **生命周期**：滑动续期 + `max` 可配（`<=0` 无上限）。钉死命门不变量：续期不轮换 session id、只写 Redis expiry、不产生 Set-Cookie。一旦续期轮换 id，就重新撞透传。
6. **纯 opaque vs 混合**：论证 JWT 对本项目无必要——单后端、博客流量、Redis 已在热路径、SSR 是主战场。混合方案把透传卡点和 rotation 复杂度请回，是负收益。
7. **概念澄清**：opaque session 照样用 cookie（cookie 是载体，JWT/opaque 是内容）。"用不用 cookie"与"用不用 JWT"是正交维度。bilibili 用 cookie，cookie 里装的是 opaque id 而非 JWT。
8. **登录方式**：项目本有邮箱密码 + GitHub + Google 三种登录，全部保留，只换底层 cookie/session 架构。
9. **无兼容层**：不维护双轨、不做旧 JWT 向新 session 的转换，tokenStore / JWT / refresh 整套干净删除，强制重登。

## 4. 最终架构摘要

- **cookie**：`mimo_session`（HttpOnly，opaque session id）+ `mimo_csrf`（double-submit CSRF）+ `mimo_uid`（可选，前端直读）。
- **后端**：session 聚合根 + Redis 存储 + 中间件，读 cookie → 查 session → 注入 user ctx → 滑动续期。
- **生命周期**：滑动续期（idle）+ 可选绝对寿命（max，`<=0` 无上限）。
- **SSR**：调只读 `/auth/session` 拿 claims，绝不续期、绝不 Set-Cookie。
- **命门不变量**：(1) SSR 只读不写；(2) 续期不轮换 id、不 Set-Cookie。

## 5. 被否决方案的理由

- **A（保留 JWT 修透传）**：需引入 jose + 公钥分发，access 短命仍要 refresh，治标不治本；ADR-0002 此方向从未实施。
- **C（opaque + JWT 混合）**：rotation / 双过期回归，refresh 换 JWT 重新撞透传，违背简化初衷。
- **D（better-auth）**：引入第三方依赖、需与 Go 后端适配层、黑盒度高；技术栈已定为自建。

## 6. 与历史文档的关系

- **ADR-0001**（refresh rotation invariants）：superseded。rotation 整套删除，不变量 1、2 不再适用；不变量 3（吊销不可静默失败）的精神迁移到 session 删除。
- **ADR-0002**（SSR 直验 JWT）：superseded。SSR 改为读 opaque session，不再直验 JWT。
- **ssr-auth-refactor-handoff.md**：其中"方向 A（SSR 续期）"取消——opaque session 让 SSR 不需要续期，handoff 待验证的"request middleware 能否透传 Set-Cookie"不再是阻塞项，因为新方案 SSR 根本不写 cookie。
