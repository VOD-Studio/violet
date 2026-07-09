# SSR 认证架构重构交接文档

> 本文档记录 SSR 认证问题的诊断脉络、业界调研结论、待验证的关键技术点，以及两套候选实现方案。
> 配套决策记录见 `../adr/0002-ssr-auth-stateless-jwt-direct-verify.md`（其「SSR 不续期」决策在业界调研后待修正）。

## 背景：为什么需要这次重构

前台路由（SSR）会"莫名其妙掉登录"，且掉登录时无重登提示。经多轮诊断，定位到根因链：

1. SSR 的 server function 用 axios 调后端 `/auth/me` 鉴权
2. 其 401 拦截器会触发 SSR 端 refresh
3. refresh 在服务端进程内能成功（200），但 **TanStack Start 的 server function 以 JSON-over-fetch 返回，Set-Cookie 响应头不会透传给浏览器**
4. 浏览器永远收不到新 cookie → 持续掉登录，必须手动重登

**确证证据**：浏览器 Network 面板看不到 refresh 请求，但后端日志有 `POST /auth/refresh 200`。

## 已修复的历史层（不要回退）

| commit | 修复内容 |
|---|---|
| `c86188f` | refresh cookie Path 从 `/api/v1/auth` 改 `/`（SSR 能拿到 refresh cookie） |
| `346abc9` | refresh 后重放写请求重新注入最新 CSRF token（修复 CSRF 403） |
| `2913553` | 跨 tab refresh 改 queue 模式（修复 rotate_reused 误伤） |
| `5f3bd59` / `e34c0fa` | refresh 失败补 `reason=` 结构化日志（parse_failed/rotate_reused/rotate_invalid/empty_refresh_token） |

注：ADR-0001 L19 描述的是"跳过"模式，实际代码已是 queue 模式，文档描述滞后但代码正确。

## 业界调研结论：大型项目都做 SSR 续期

| 项目 | session 模型 | SSR 续期 | 机制 |
|---|---|---|---|
| Supabase | JWT + refresh | ✅ | `middleware.ts` 的 `updateSession()` 每请求检查 + Set-Cookie |
| Auth.js (NextAuth) | JWT 或 DB session | ✅ | refresh callback + middleware |
| Better-Auth + TanStack Start | session cookie | ✅ | server function 转发 cookie + 后端处理 |
| B 站 | opaque session（SESSDATA） | ✅ | 传统 SSR，Set-Cookie 直出 |
| GitHub / Discord | opaque session | ✅ | 传统 SSR |

**业界共识：SSR 续期是标准做法。** ADR-0002 当前的"SSR 不续期，交给客户端"是 TanStack Start server function 限制下的妥协，偏离业界标准。

### 为什么 Supabase 能做而本项目卡住

- **Supabase 用 Next.js `middleware.ts`**——拦截的是真正的浏览器 HTTP 请求，response 的 Set-Cookie 直接回浏览器。
- **本项目用 TanStack Start server function**——以 JSON-over-fetch 返回，Set-Cookie 被吞。

## 关键未知点：TanStack Start request middleware 能否透传 Set-Cookie

这是整个修正方向的地基。TanStack Start 的 **request middleware**（`createMiddleware({ type: 'request' })`，通过 `src/start.ts` 注册）拦截的是不是真正的 HTTP 请求？它的 response Set-Cookie 能不能透传浏览器？

官方文档说 request middleware "executes in the same context as server functions, so you can read and modify anything about the request headers, status codes, etc."——但**没明确说 Set-Cookie 会写入浏览器 cookie jar**。

**必须先做最小验证再决定方向**（见下文「验证步骤」）。

参考：
- [TanStack Start: Middleware 官方文档](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Supabase SSR Auth Guide](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers)
- [TanStack Start: Authentication Server Primitives](https://tanstack.com/start/latest/docs/framework/react/guide/authentication-server-primitives)
- [Bug: Only the last Set-Cookie takes effect on server route #5464](https://github.com/TanStack/router/issues/5464)

## 验证步骤（实现前必做）

写一个最小验证：创建 `src/start.ts` + 一个 request middleware，在里面 `setCookie` 一个测试值，刷新页面看浏览器能否收到该 cookie。

这一个验证决定方向：
- **能透传** → 采用方向 A（SSR 续期，对齐业界标准）
- **不能透传** → 采用方向 B（SSR 不续期，= ADR-0002 现状）

## 两套候选实现（验证后二选一）

### 方向 A：SSR 续期（验证通过则采用）

对齐 Supabase `updateSession()` 模式：
1. `createMiddleware({ type: 'request' })` 在 `src/start.ts` 注册
2. middleware 读 access cookie + jose 验 ES256 → claims 注入 router context
3. **access 过期时**：middleware 调 `/auth/refresh`（server-side http client）+ **把新 cookie 设到 response 上**（Set-Cookie 透传浏览器）
4. beforeLoad 读 context 做守卫
5. 无闪烁，体验最佳

### 方向 B：SSR 不续期（验证失败则采用，= ADR-0002 现状）

1. middleware/beforeLoad 只验签，不续期
2. access 过期 → SSR 返回未登录 → 客户端 hydrate 后 axios 拦截 401 → 调 `/auth/refresh`（真实 HTTP，Set-Cookie 正确写入）
3. 代价：access 过期瞬间"游客→登录"闪烁
4. 详见 ADR-0002

## 不变的实现要点（两方向共享）

- **引入 jose**（`pnpm add jose`，Node 端 JWT 验签，零依赖，支持 ES256）
- **公钥**：`api/jwt_public_key.pem`（ES256 公钥，可安全给前端验签，无私钥泄露）。dev 读相对路径，生产配 env
- **access JWT claims 字段**：`user_id/email/role/role_id/is_builtin_super_admin` + RegisteredClaims（exp/iat/sub/iss）。**无 permissions**（permissions 是动态查询，不进 JWT）
- **admin.tsx 守卫适配**：去掉 `permissions?.includes("admin:access")`（claims 无 permissions），只判 role；细粒度权限交客户端 PermissionGuard
- **RouterContext.auth 类型**：从 `UserDTO | null` 改为 `AuthClaims | null`
- **Header 闪烁缓解**：claims 构造精简 UserDTO 注入 query cache
- **sessionActive 机制保留**：mutations/Header/守卫三处读点无改动
- **只改前端，不改后端**（`/auth/me`、`/auth/refresh` 端点保持，客户端仍调）

## 实现提交拆分（按 AGENTS.md 原子性）

1. `feat(web): 封装 SSR access JWT 验签工具`（jose + verifyAccessJWT）
2. 认证 middleware 或 beforeLoad 改造（验证后定方案）
3. RouterContext.auth 类型 + 守卫适配
4. 防御性：SSR http client 不触发 refresh（typeof window 守卫）

## 验证标准

- `pnpm typecheck && pnpm lint && pnpm test`
- 手动：登录 → 等 access 过期（调短 `api/config.yaml` `jwt_access_token_ttl` 到 30s 加速）
  - 方向 A：浏览器无闪烁持续登录，Network 看到 middleware 续期
  - 方向 B：短暂闪烁后客户端 refresh 恢复
- 关键：浏览器 Network **看不到 SSR server function 吞 Set-Cookie 的 refresh**（这是当前 bug 根因）
- 不违反 ADR-0001（refresh 不变量全在后端，SSR 不碰）

## 注意事项

- 用户浏览器可能有旧 cookie 残留，验证时清 cookie 或用无痕窗口
- jose 是新依赖，首次 `pnpm add jose` 改 lockfile
- 公钥路径 dev 相对路径，生产部署需配 env
- 本重构只改前端，不改后端
