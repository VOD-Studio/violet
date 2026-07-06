# Frontend Auth Session Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor frontend authentication to use opaque session cookies instead of stateless JWTs, simplifying the HTTP client, reducing SSR overhead by using a read-only session probe (`/auth/session`), and cleaning up all JWT-related workarounds.

**Architecture:** 
1. Delete complex client-side JWT refresh scheduling (`token-scheduler.ts`), locking/de-duplication (`refresh-queue.ts`), and request replaying (`auth-gate.ts`).
2. Simplify the HTTP client response interceptor: when a `401 Unauthorized` is returned by a non-probe request, clear the active session state and open the login dialog directly (no token refresh or request queueing).
3. Change SSR session validation to call the read-only `/auth/session` endpoint via `getServerHttpClient()`, retrieving and storing serializable claims in the router context.
4. Refactor client-side login/logout mutations, callback routes, and the `LoginDialog` to consume session cookies rather than handling JWT access tokens.

**Tech Stack:** React 19, Vite, TanStack Router, TanStack Query, Zustand, Axios.

## Global Constraints

- Use `pnpm` for all frontend package management operations. Do not use `npm` or `yarn`.
- Follow Biome rules for linting and formatting. Run `make web-lint` and `make web-format` to verify/format.
- Ensure type correctness with `make web-typecheck`.
- Ensure all tests pass with `make web-test`.
- Create a distinct Git commit for each task. Use Conventional Commits format in Chinese (e.g. `feat(web): ...` or `refactor(web): ...`).

---

### Task 1: Delete JWT Frontend Components and Refactor Helper Files

**Files:**
- Delete: `web/src/shared/api/auth-gate.ts`
- Delete: `web/src/shared/api/refresh-queue.ts`
- Delete: `web/src/shared/api/token-scheduler.ts`
- Delete: `web/src/shared/api/__tests__/refresh-queue.test.ts`
- Delete: `web/src/widgets/AuthDebugPanel/AuthDebugPanel.tsx`
- Delete: `web/src/widgets/AuthDebugPanel/index.ts`
- Modify: `web/src/shared/lib/cookies.ts`
- Modify: `web/src/shared/server/cookies.ts`

**Interfaces:**
- Consumes: None
- Produces: Cleaned up filesystem, updated comments in cookie helper files.

- [ ] **Step 1: Delete the JWT and refresh-related files**

Remove the files from the codebase:
- `web/src/shared/api/auth-gate.ts`
- `web/src/shared/api/refresh-queue.ts`
- `web/src/shared/api/token-scheduler.ts`
- `web/src/shared/api/__tests__/refresh-queue.test.ts`
- `web/src/widgets/AuthDebugPanel/AuthDebugPanel.tsx`
- `web/src/widgets/AuthDebugPanel/index.ts`

- [ ] **Step 2: Update cookie documentation in helper files**

In `web/src/shared/lib/cookies.ts`, update line 5:
```typescript
 * HttpOnly cookie（如 mimo_session）JS 无法读取，
```

In `web/src/shared/server/cookies.ts`, update line 14:
```typescript
 * @returns 完整的 Cookie header 字符串（如 "mimo_session=xxx; mimo_csrf=yyy"），无则空串
```

- [ ] **Step 3: Commit changes**

```bash
git add web/src/shared/lib/cookies.ts web/src/shared/server/cookies.ts
git rm web/src/shared/api/auth-gate.ts web/src/shared/api/refresh-queue.ts web/src/shared/api/token-scheduler.ts web/src/shared/api/__tests__/refresh-queue.test.ts
git rm -r web/src/widgets/AuthDebugPanel
git commit -m "refactor(web): 清理 JWT 相关的 refresh-queue、auth-gate 与调试面板文件"
```

---

### Task 2: Simplify HTTP Client Interceptor

**Files:**
- Modify: `web/src/shared/api/http.ts`

**Interfaces:**
- Consumes: `useLoginDialogStore` from `@features/auth/model/login-dialog-store` for opening login dialog.
- Produces: Simplified `createHttpClient` and `httpClient` export without refresh or request replay logic.

- [ ] **Step 1: Simplify imports in `web/src/shared/api/http.ts`**

Remove imports of `notifySessionExpired`, `requestReplay`, `setReplayer` from `./auth-gate`, `triggerRefresh` from `./refresh-queue`, and `scheduleRefresh`, `setOnSessionExpired`, `setRefresher` from `./token-scheduler`.

Add import:
```typescript
import { useLoginDialogStore } from "@/features/auth/model/login-dialog-store";
```

- [ ] **Step 2: Remove retried/refresh configuration typings**

Remove:
```typescript
        __retried?: boolean;
```
from the `declare module "axios"` request config interface. Keep `__skipAuthGate?: boolean;`.

- [ ] **Step 3: Update `createHttpClient` response interceptor error handler**

Refactor the error handler (around line 137) to remove all refresh, queueing, and replaying logic:
```typescript
        async (err: AxiosError) => {
            const status = err.response?.status ?? 0;

            // 401 处理：清除会话活跃状态，如果非探活请求则在客户端弹出登录弹窗
            if (status === 401 && err.config && !err.config.__skipAuthGate) {
                clearSessionActive();
                if (typeof window !== "undefined") {
                    useLoginDialogStore.getState().open();
                }
            }
```

- [ ] **Step 4: Remove client singletons setup logic**

Remove lines 229-259 containing `setReplayer`, `setRefresher`, and `setOnSessionExpired`.

- [ ] **Step 5: Verify types compile**

Run: `pnpm --filter web typecheck`
Expected: Compile errors in `queries.ts`, `mutations.ts`, `__root.tsx`, and `admin.tsx` due to missing scheduler or deleted functions (these will be fixed in the next tasks).

- [ ] **Step 6: Commit changes**

```bash
git add web/src/shared/api/http.ts
git commit -m "refactor(web): 简化 HTTP 客户端拦截器，401 错误直接踢出并打开登录弹窗"
```

---

### Task 3: SSR Authentication using `/auth/session` Claims

**Files:**
- Modify: `web/src/features/auth/model/types.ts`
- Modify: `web/src/router.tsx`
- Modify: `web/src/shared/server/session.ts`
- Modify: `web/src/routes/__root.tsx`
- Modify: `web/src/routes/admin.tsx`

**Interfaces:**
- Consumes: Backend GET `/auth/session` endpoint.
- Produces: `SessionClaims` type, updated `RouterContext` interface, and refined server function `getCurrentSession`.

- [ ] **Step 1: Add `SessionClaims` interface in types**

In `web/src/features/auth/model/types.ts`, export the `SessionClaims` interface:
```typescript
/**
 * SessionClaims - GET /auth/session 返回的会话 Claims 信息
 */
export interface SessionClaims {
    user_id: string;
    role: string;
    email: string;
    is_builtin_super_admin: boolean;
}
```

- [ ] **Step 2: Update `RouterContext` in `web/src/router.tsx`**

Import `SessionClaims` and change `auth` property in `RouterContext` (line 15) and initialization in `getRouter` (line 39):
```typescript
import type { SessionClaims } from "./features/auth/model/types";

export interface RouterContext {
    queryClient: QueryClient;
    auth: {
        isAuthenticated: boolean;
        claims: SessionClaims | null;
    };
}
```
Update the default context in `getRouter`:
```typescript
        context: {
            queryClient: clientQueryClient,
            auth: { isAuthenticated: false, claims: null },
        },
```

- [ ] **Step 3: Refactor `web/src/shared/server/session.ts`**

Replace `getCurrentUser` with `getCurrentSession` returning `SessionClaims | null`:
```typescript
import { createServerFn } from "@tanstack/react-start";
import type { SessionClaims } from "../../features/auth/model/types";
import { getServerHttpClient } from "./auth";

/**
 * getCurrentSession - 获取当前登录会话 Claims（server function）
 *
 * 转发浏览器 cookie 到后端 GET /auth/session：
 * - cookie 有效 → 返回 SessionClaims
 * - cookie 无效/缺失 → 返回 null
 */
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
    async (): Promise<SessionClaims | null> => {
        try {
            const client = getServerHttpClient();
            const res = await client.get<{ data: SessionClaims }>("/auth/session");
            return res.data.data;
        } catch {
            return null;
        }
    },
);
```

- [ ] **Step 4: Update `web/src/routes/__root.tsx`**

Import `getCurrentSession` instead of `getCurrentUser`.
Update the `beforeLoad` function:
```typescript
import { getCurrentSession } from "../shared/server/session";
// ...
export const Route = createRootRouteWithContext<RouterContext>()({
    beforeLoad: async ({ context }) => {
        const claims = await getCurrentSession();
        // 客户端同步 sessionActive：SSR 已确认登录的用户，hydrate 后立即把
        // 响应式 session 标志置 true，让 Header 等订阅者与守卫的客户端逻辑生效。
        if (claims && typeof window !== "undefined") {
            markSessionActive();
        }
        return {
            auth: {
                isAuthenticated: claims !== null,
                claims,
            },
        };
    },
// ...
```
Remove `context.queryClient.setQueryData(authKeys.me(), user);` entirely.

- [ ] **Step 5: Refactor `web/src/routes/admin.tsx`**

Update the `beforeLoad` function of `/admin` to verify roles based on claims:
```typescript
    beforeLoad: async ({ context }) => {
        const { auth } = context;

        // 仅当「网络判定未登录」且「客户端确实没有活跃会话」时才踢人。
        if ((!auth.isAuthenticated || !auth.claims) && !isSessionActive()) {
            throw redirect({
                to: "/",
                replace: true,
            });
        }

        // 检查用户是否是管理员角色（admin 或 superadmin）或者内置超级管理员
        if (auth.claims) {
            const isAdminRole = auth.claims.role === "admin" || auth.claims.role === "superadmin" || auth.claims.is_builtin_super_admin;
            if (!isAdminRole) {
                throw redirect({
                    to: "/",
                    replace: true,
                });
            }
        }
    },
```

- [ ] **Step 6: Commit changes**

```bash
git add web/src/features/auth/model/types.ts web/src/router.tsx web/src/shared/server/session.ts web/src/routes/__root.tsx web/src/routes/admin.tsx
git commit -m "feat(web): 前端 SSR 鉴权改 /auth/session 只读探活并更新路由上下文"
```

---

### Task 4: Refactor Login, Logout Mutations, OAuth callbacks, and LoginDialog

**Files:**
- Modify: `web/src/features/auth/api/mutations.ts`
- Modify: `web/src/features/auth/ui/LoginDialog.tsx`
- Modify: `web/src/routes/login.tsx`

**Interfaces:**
- Consumes: Backend POST `/auth/login`, POST `/auth/logout`, and OAuth callback APIs.
- Produces: Refactored mutations and dialog without local token management, query cache invalidation on login/logout success.

- [ ] **Step 1: Clean up token schemas and mutations in `web/src/features/auth/api/mutations.ts`**

1. Remove type imports: `TokenResponse`, `RefreshRequest`.
2. Remove `useRefresh` mutation entirely, as well as `fetchRefresh` function.
3. Remove imports of `clearRefresh`, `scheduleRefresh` from `@shared/api/token-scheduler`.
4. Update `LoginResponse` type expectation. Since backend returns `{ user_id: string }`, let's define `LoginResponse` interface in `web/src/features/auth/model/types.ts`:
   ```typescript
   export interface LoginResponse {
       user_id: string;
   }
   ```
5. In `mutations.ts`, replace `TokenResponse` with `LoginResponse` in `useLogin`, `googleLogin`, `useGoogleLoginMutation`, `githubLogin`, and `useGithubLoginMutation`.
6. Update `useLogin`, `useGoogleLoginMutation`, and `useGithubLoginMutation` success handlers to only call `markSessionActive()` and invalidate query keys, removing the `scheduleRefresh` call.
   For example, `useLogin` should be:
   ```typescript
   export const useLogin = (csrfToken?: string) => {
       const qc = useQueryClient();
       return useMutation({
           mutationFn: (body: LoginRequest) => {
               const token = csrfToken || getCSRFToken();
               return apiPost<LoginResponse>("/auth/login", body, {
                   headers: token ? { [CSRF_HEADER]: token } : undefined,
                   __skipAuthGate: true,
               });
           },
           onSuccess: () => {
               qc.invalidateQueries({ queryKey: authKeys.me() });
               markSessionActive();
           },
       });
   };
   ```
7. In `useLogout`'s success handler, remove `clearRefresh()`. Keep query invalidations/removals and `clearSessionActive()`.

- [ ] **Step 2: Clean up `web/src/features/auth/ui/LoginDialog.tsx`**

1. Remove imports of `flush`, `rejectAll`, `setOpener` from `@shared/api/auth-gate`.
2. Remove `useEffect` setting `setOpener`.
3. In `handleGoogleLogin.onSuccess`, remove `await flush()`.
4. In `handleSubmit.onSuccess`, remove `await flush()`.
5. In `handleOpenChange`, simplify the cancel flow to remove `rejectAll()` and `closingForSuccess` references:
   ```typescript
       const handleOpenChange = (next: boolean) => {
           if (next) {
               open();
               return;
           }
           // 用户主动放弃重登：清缓存、清会话活跃标志、关闭弹窗、跳回首页（如果在保护页）
           qc.removeQueries({ queryKey: authKeys.me() });
           clearSessionActive();
           close();
           setForm((f) => ({ ...f, password: "" }));

           const needsAuth = pathname.startsWith("/profile") || pathname.startsWith("/admin");
           if (needsAuth) {
               navigate({ to: "/", replace: true }).catch(() => {});
           }
       };
   ```
   *Note: Remove `closingForSuccess` ref and references entirely. Since we do not queue requests anymore, we don't have to distinguish programmatic close.*

- [ ] **Step 3: Update `web/src/routes/login.tsx` Google login success handler**

Update `googleLogin.mutate(tokenResponse.access_token, { onSuccess: async () => { ... } })` success handler to match `LoginResponse` (no token dependencies). This is already mostly clean, but verify no scheduler calls exist.

- [ ] **Step 4: Commit changes**

```bash
git add web/src/features/auth/api/mutations.ts web/src/features/auth/ui/LoginDialog.tsx web/src/routes/login.tsx
git commit -m "feat(web): 前端登录登出适配 Session Cookie，删除 Token/Refresh 逻辑与定时器"
```

---

### Task 5: Code Quality & Quality Assurance

- [ ] **Step 1: Check code types and compile**

Run: `make web-typecheck`
Expected: Passes with no errors.

- [ ] **Step 2: Check formatting and linting**

Run: `make web-format`
Run: `make web-lint`
Expected: Biome runs with no errors or warnings.

- [ ] **Step 3: Run frontend unit tests**

Run: `make web-test`
Expected: Passes with no failures.

- [ ] **Step 4: Run backend tests to verify integration isn't broken**

Run: `make api-test`
Expected: Passes.

- [ ] **Step 5: Final Git checks**

Ensure there are no untracked files or leftover comments.
```bash
git status
```
All commits are stored locally.
