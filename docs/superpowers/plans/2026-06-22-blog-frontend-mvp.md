# 博客前端 v2.0 首期实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `web/` 原位重建 React 前端首期 MVP——首页 + nav 骨架 + 全局组件，对接已实装的后端 cookie + CSRF 鉴权方案。

**Architecture:** FSD 七层架构 + TanStack Start SSR + 双 token HttpOnly cookie 鉴权。axios 统一封装（`withCredentials` + 自动 CSRF header + 401 refresh 队列），feature 三段式（api/model/ui），shadcn/react-bits 走 CLI 引入。

**Tech Stack:** React 19 + TanStack Start v1 RC + TanStack Query v5 + Zustand v5 + axios + Tailwind v4 + shadcn/ui + react-bits + Biome v2 + pnpm

**Spec:** `docs/superpowers/specs/2026-06-22-blog-frontend-design.md`

**后端依赖：** commit `4a3f333`（cookie）+ `7899e79`（CSRF）已落地。后端运行在 `http://localhost:8080`，前端开发服务器 `http://localhost:5173`。

---

## 文件结构总览

按依赖顺序（底层 → 高层）：

```
web/
├── package.json / pnpm-workspace.yaml / tsconfig*.json
├── vite.config.ts / app.config.ts
├── biome.json / components.json
├── .npmrc / .nvmrc / .editorconfig / .env.example
├── public/llms.txt
├── .ai/                              各库 llms.txt（不进 bundle）
├── src/
│   ├── styles/globals.css            Tailwind v4 + CSS 变量双主题
│   ├── app/
│   │   ├── router.tsx                createRouter + RouterContext
│   │   ├── client.tsx                client mount
│   │   ├── ssr.tsx                   SSR 入口
│   │   ├── api.ts                    createServerFn 入口
│   │   └── provider.tsx              QueryClientProvider + ThemeProvider + Toaster
│   ├── routes/
│   │   ├── __root.tsx                根布局（Header + Outlet + Footer + MusicPlayer）
│   │   ├── index.tsx                 / 首页
│   │   ├── blog/index.tsx            /blog（占位）
│   │   ├── about/index.tsx           /about（占位）
│   │   ├── projects/index.tsx        /projects（占位）
│   │   ├── profile/index.tsx         /profile（占位 + beforeLoad 守卫）
│   │   └── login.tsx                 /login（占位）
│   ├── shared/
│   │   ├── api/
│   │   │   ├── http.ts               axios 实例 + interceptors
│   │   │   ├── refresh-queue.ts      401 并发队列
│   │   │   ├── csrf.ts               读 mimo_csrf cookie → 注入 X-CSRF-Token
│   │   │   ├── error.ts              ApiError
│   │   │   ├── query-client.ts       createQueryClient
│   │   │   └── types.ts              Envelope/Pagination/ImportMetaEnv
│   │   ├── server/
│   │   │   ├── auth.ts               转发 cookie 到 axios
│   │   │   ├── session.ts            getCurrentUser
│   │   │   ├── cookies.ts            双端 cookie 读写
│   │   │   └── seo.ts                meta 注入
│   │   ├── ui/                       shadcn 原子（button/dialog/...）
│   │   │   └── coming-soon.tsx
│   │   ├── vendor/react-bits/        CLI 引入
│   │   ├── lib/
│   │   │   ├── utils.ts              cn
│   │   │   ├── theme.ts              主题工具
│   │   │   └── cookies.ts            浏览器 cookie 读写
│   │   └── config/
│   │       ├── env.ts                env 解析
│   │       └── nav.ts                nav 单一来源
│   ├── entities/user/
│   │   └── model/types.ts            UserDTO
│   ├── features/
│   │   ├── posts/                    首页文章列表
│   │   ├── github/                   贡献图
│   │   ├── settings/                 站点信息 + 公告 + 主题 store
│   │   ├── music/                    UI store + 数据 hook
│   │   └── auth/                     useMe + login/logout hooks
│   └── widgets/
│       ├── Header/                   nav + 主题 + 登录
│       ├── Footer/
│       ├── MusicPlayer/
│       ├── AnnouncementBar/
│       ├── ThemeToggle/
│       └── Hero/
└── scripts/                          自定义守护脚本（一文件一组件等）
```

---

## Task 1: 工程脚手架与工具链

**Files:**
- Create: `web/package.json`、`web/pnpm-workspace.yaml`、`web/.npmrc`、`web/.nvmrc`、`web/.editorconfig`、`web/.env.example`、`web/tsconfig.json`、`web/tsconfig.app.json`、`web/tsconfig.node.json`
- Create: `web/vite.config.ts`、`web/app.config.ts`
- Create: `web/biome.json`、`web/components.json`

- [ ] **Step 1: 用 TanStack CLI 脚手架创建工程**

```bash
cd /Users/sun/Developer/blog-project
# 临时创建到 web-tmp，再合并到 web/
npx @tanstack/cli@latest create web-tmp --template basic --package-manager pnpm --no-git
```

合并到 `web/`（保留 CLI 生成的 router/client/ssr 骨架与依赖版本）：
```bash
mv web-tmp web
cd web
```

- [ ] **Step 2: 安装运行时依赖**

```bash
cd web
pnpm add zustand react-hook-form zod axios axios-retry next-themes date-fns sonner lucide-react motion
```

- [ ] **Step 3: 安装开发依赖**

```bash
pnpm add -D @biomejs/biome vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: 配置 `.nvmrc` 与 `.npmrc`**

`web/.nvmrc`:
```
22
```

`web/.npmrc`:
```
shamefully-hoist=true
strict-peer-dependencies=false
```

- [ ] **Step 5: 写 `tsconfig.json`（含 paths 别名）**

`web/tsconfig.json`（合并 CLI 生成内容，追加 paths）：
```jsonc
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/app/*"],
      "@routes/*": ["src/routes/*"],
      "@widgets/*": ["src/widgets/*"],
      "@features/*": ["src/features/*"],
      "@entities/*": ["src/entities/*"],
      "@shared/*": ["src/shared/*"],
      "@server/*": ["src/shared/server/*"],
      "@ui": ["src/shared/ui"],
      "@ui/*": ["src/shared/ui/*"],
      "@lib/*": ["src/shared/lib/*"],
      "@config/*": ["src/shared/config/*"],
      "@vendor/react-bits/*": ["src/shared/vendor/react-bits/*"]
    }
  }
}
```

- [ ] **Step 6: 写 `.env.example`**

`web/.env.example`:
```bash
# 客户端：浏览器同源相对路径（由反向代理转发到后端）
VITE_API_BASE_URL=/api/v1
# 前端对外地址（SEO、OpenGraph）
VITE_SITE_URL=http://localhost:5173
# SSR server 端：内网直连后端
VITE_SSR_API_BASE_URL=http://localhost:8080/api/v1
```

- [ ] **Step 7: 写 `biome.json`**

`web/biome.json`:
```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.1.2/schema.json",
  "files": {
    "ignore": ["src/shared/vendor/**", "src/routeTree.gen.ts"]
  },
  "linter": {
    "rules": {
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error",
        "noDefaultExport": "warn",
        "useNamingConvention": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noArrayIndexKey": "warn",
        "noConfusingLabels": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": { "maxAllowedComplexity": 15 }
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

- [ ] **Step 8: 写 `components.json`（shadcn/react-bits CLI）**

`web/components.json`:
```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "ui": "@shared/ui",
    "components": "@shared/vendor/react-bits",
    "lib": "@shared/lib",
    "utils": "@shared/lib/utils",
    "hooks": "@shared/lib/hooks"
  }
}
```

- [ ] **Step 9: 验证脚手架启动**

```bash
cd web
cp .env.example .env
pnpm dev
```

Expected: Vite 启动，浏览器打开 `http://localhost:5173` 显示 TanStack 默认页面，无报错。Ctrl+C 停止。

- [ ] **Step 10: Commit**

```bash
git add web/
git commit -m "feat(web): 工程脚手架 - TanStack Start + pnpm + biome 配置"
```

---

## Task 2: Tailwind v4 + 双主题 CSS

**Files:**
- Create: `web/src/styles/globals.css`
- Modify: `web/vite.config.ts`（加 `@tailwindcss/vite` 插件）

- [ ] **Step 1: 安装 Tailwind v4**

```bash
cd web
pnpm add -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: 写 `globals.css`（双主题 CSS 变量）**

`web/src/styles/globals.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

@theme {
  --color-border: hsl(var(--border));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --font-sans: "Inter", system-ui, sans-serif;
}

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
  }

  * {
    border-color: hsl(var(--border));
  }

  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
  }
}
```

- [ ] **Step 3: 在 `vite.config.ts` 注册 Tailwind 插件**

`web/vite.config.ts`（在现有 `defineConfig` 的 plugins 数组加入）：
```ts
import tailwindcss from "@tailwindcss/vite";

// 在 plugins 数组中加入：
tailwindcss(),
```

- [ ] **Step 4: 在 `__root.tsx` 或 `app/ssr.tsx` 引入 globals.css**

修改 TanStack 生成的 `src/routes/__root.tsx`，顶部添加：
```ts
import "../styles/globals.css";
```

- [ ] **Step 5: 验证**

```bash
cd web && pnpm dev
```

Expected: 页面加载，无 CSS 报错；浏览器 devtools 检查 `<html>` 没有 `.dark` class，背景为白色。手动在 devtools 加 `<html class="dark">`，背景应变深色。

- [ ] **Step 6: Commit**

```bash
git add web/src/styles/globals.css web/vite.config.ts web/src/routes/__root.tsx web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): Tailwind v4 + CSS 变量双主题"
```

---

## Task 3: shadcn/ui + react-bits CLI 引入基础组件

**Files:**
- Create: `web/src/shared/ui/button.tsx`、`web/src/shared/ui/dialog.tsx`、`web/src/shared/ui/sheet.tsx`、`web/src/shared/ui/skeleton.tsx`、`web/src/shared/ui/sonner.tsx`、`web/src/shared/lib/utils.ts`
- Create: `web/src/shared/vendor/react-bits/backgrounds/Aurora.tsx`
- Create: `web/src/shared/vendor/react-bits/text-animations/GradientText.tsx`、`DecryptedText.tsx`

- [ ] **Step 1: 安装 shadcn 所需运行时依赖**

```bash
cd web
pnpm add class-variance-authority clsx tailwind-merge tw-animate-css
```

- [ ] **Step 2: 写 `lib/utils.ts`（cn 工具，shadcn 必需）**

`web/src/shared/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn - 合并 Tailwind class，处理冲突
 *
 * shadcn/ui 组件统一使用此工具合并 class
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

- [ ] **Step 3: shadcn CLI 引入 UI 原子**

```bash
cd web
pnpm dlx shadcn@latest add button dialog sheet skeleton sonner
```

Expected: 文件生成到 `src/shared/ui/`（由 `components.json` 的 aliases 控制）。

- [ ] **Step 4: react-bits CLI 引入 3 个组件**

```bash
pnpm dlx shadcn@latest add "@react-bits/Aurora-TS-TW"
pnpm dlx shadcn@latest add "@react-bits/GradientText-TS-TW"
pnpm dlx shadcn@latest add "@react-bits/DecryptedText-TS-TW"
```

Expected: 文件生成到 `src/shared/vendor/react-bits/`。

- [ ] **Step 5: 修正 react-bits 组件颜色为 CSS 变量（双主题适配）**

打开 `src/shared/vendor/react-bits/backgrounds/Aurora.tsx`，将其中的固定色值（如 `#1e90ff`）改为 CSS 变量引用：
```tsx
// 改前（示例）：
// colors={["#1e90ff", "#5b8ee5", "#a3c1f5"]}
// 改后：
colors={["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted))"]}
```

对 `GradientText.tsx`、`DecryptedText.tsx` 做同样处理。如果默认色值合理可保留，但主色调用 CSS 变量。

- [ ] **Step 6: 验证引入**

```bash
pnpm tsc --noEmit
```

Expected: 零 error。

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat(web): shadcn/ui + react-bits CLI 引入基础组件"
```

---

## Task 4: shared/api 基础设施（类型 + 错误 + axios 封装）

**Files:**
- Create: `web/src/shared/api/types.ts`
- Create: `web/src/shared/api/error.ts`
- Create: `web/src/shared/api/csrf.ts`
- Create: `web/src/shared/api/http.ts`
- Create: `web/src/shared/api/refresh-queue.ts`
- Create: `web/src/shared/api/query-client.ts`

- [ ] **Step 1: 写 `shared/api/types.ts`（纯类型，对接后端 envelope）**

`web/src/shared/api/types.ts`:
```ts
/**
 * API 类型定义
 *
 * 对接后端统一响应封装（commit 4179965），所有 HTTP 响应都遵循此结构。
 */

/** 后端统一响应信封 */
export interface Envelope<T = unknown> {
  /** 业务数据载荷 */
  data: T;
  /** 元数据（消息或分页），可省略 */
  meta?: EnvelopeMeta<T>;
}

/** 信封元数据 */
export interface EnvelopeMeta<T = unknown> {
  /** 操作消息（如删除成功） */
  message?: string;
  /** 分页信息 */
  pagination?: Pagination;
}

/** 分页元数据（offset 模式） */
export interface Pagination {
  /** 当前页码（offset 模式） */
  page?: number;
  /** 每页条数 */
  limit: number;
  /** 总记录数（offset 模式） */
  total?: number;
  /** 总页数（offset 模式） */
  total_pages?: number;
  /** 是否还有下一页（cursor 模式 / offset 便利字段） */
  has_more?: boolean;
  /** 下一页游标（cursor 模式） */
  next_cursor?: string;
}

/** 后端错误响应（不在 data 字段下，独立结构） */
export interface ApiErrorShape {
  /** 机器错误码：NOT_FOUND / UNAUTHORIZED / FORBIDDEN / INTERNAL_ERROR 等 */
  error: string;
  /** 人类可读消息 */
  message: string;
  /** 请求追踪 ID */
  request_id?: string;
  /** 字段级校验错误 */
  details?: Record<string, string[]>;
}

/** offset 分页查询参数 */
export interface PageQuery {
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数 */
  limit?: number;
}

/** 分页响应（httpClient 解包后的形态） */
export interface PagedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 分页元数据 */
  pagination: Pagination;
}
```

- [ ] **Step 2: 写 `shared/api/error.ts`**

`web/src/shared/api/error.ts`:
```ts
import type { ApiErrorShape } from "./types";

/**
 * ApiError - 归一化的 API 错误
 *
 * httpClient 的 response interceptor 把后端错误响应（或网络错误）
 * 统一转成此类型抛出，业务层只需 catch ApiError 即可。
 */
export class ApiError extends Error {
  /** 机器错误码 */
  readonly code: string;
  /** HTTP 状态码（网络错误时为 0） */
  readonly status: number;
  /** 字段级校验错误 */
  readonly details?: Record<string, string[]>;
  /** 请求追踪 ID */
  readonly requestId?: string;

  constructor(shape: Pick<ApiErrorShape, "error" | "message"> & {
    status: number;
    details?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(shape.message);
    this.name = "ApiError";
    this.code = shape.error;
    this.status = shape.status;
    this.details = shape.details;
    this.requestId = shape.requestId;
  }

  /** 网络错误/超时的工厂方法 */
  static network(message = "网络错误，请检查连接"): ApiError {
    return new ApiError({ error: "NETWORK_ERROR", message, status: 0 });
  }

  /** 是否为字段校验错误（422 / 400 带 details） */
  isValidation(): boolean {
    return Boolean(this.details && Object.keys(this.details).length > 0);
  }
}
```

- [ ] **Step 3: 写 `shared/lib/cookies.ts`（浏览器 cookie 工具）**

`web/src/shared/lib/cookies.ts`:
```ts
/**
 * 浏览器 cookie 读写工具
 *
 * 仅用于读取非 HttpOnly cookie（如 mimo_csrf），HttpOnly cookie JS 无法读取。
 */

/**
 * 读取指定 cookie 值
 *
 * @param name cookie 名
 * @returns cookie 值，不存在返回空串
 */
export const getCookie = (name: string): string => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};
```

- [ ] **Step 4: 写 `shared/api/csrf.ts`（CSRF header 注入）**

`web/src/shared/api/csrf.ts`:
```ts
import { getCookie } from "../lib/cookies";

/** CSRF header 名（与后端 middleware/csrf.go 一致） */
export const CSRF_HEADER = "X-CSRF-Token";
/** CSRF cookie 名（与后端 config CookieConfig.CSRFName 一致） */
export const CSRF_COOKIE = "mimo_csrf";

/**
 * 读取当前 CSRF token（从非 HttpOnly 的 mimo_csrf cookie）
 *
 * httpClient 的 request interceptor 调用此函数，
 * 把 token 注入到 X-CSRF-Token header，配合后端 double-submit 校验。
 *
 * token 缺失时返回空串——后端会对 state-changing 请求返回 403，
 * 客户端应在首次访问时先调 GET /auth/csrf-token 取初始 token。
 *
 * @returns CSRF token 字符串，未取到返回空串
 */
export const getCSRFToken = (): string => getCookie(CSRF_COOKIE);
```

- [ ] **Step 5: 写 `shared/api/refresh-queue.ts`**

`web/src/shared/api/refresh-queue.ts`:
```ts
/**
 * 401 并发 refresh 队列
 *
 * 避免多个并发请求各自打 /auth/refresh 导致 cookie 互踩：
 * 第一个 401 触发 refresh，后续 401 请求 await 同一个 promise，
 * refresh 完成后所有请求用新 cookie 重放。
 */

let refreshing: Promise<boolean> | null = null;

/**
 * 触发 refresh（去重）
 *
 * @param doRefresh 实际执行 refresh 的函数（httpClient 注入），返回是否成功
 * @returns refresh 是否成功
 */
export const triggerRefresh = (doRefresh: () => Promise<boolean>): Promise<boolean> => {
  if (refreshing) return refreshing;
  refreshing = doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
};
```

- [ ] **Step 6: 写 `shared/api/http.ts`（axios 实例 + interceptors）**

`web/src/shared/api/http.ts`:
```ts
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

import { getCSRFToken, CSRF_HEADER } from "./csrf";
import { ApiError } from "./error";
import { triggerRefresh } from "./refresh-queue";
import type { Envelope, Pagination } from "./types";

/** httpClient 工厂选项 */
export interface HttpClientOptions {
  /** SSR server 端必须绝对 URL；客户端用相对路径 */
  baseURL?: string;
  /** SSR 时转发入口请求的 cookie header */
  forwardedCookie?: string;
}

/** 解包后的成功响应数据 */
export interface UnpackedResponse<T = unknown> {
  data: T;
  pagination?: Pagination;
}

/**
 * getBaseUrl - 根据 SSR/客户端环境返回 axios baseURL
 *
 * - 客户端：相对 /api/v1（由反向代理转发到后端）
 * - 服务端：从 VITE_SSR_API_BASE_URL 读内网地址（绕过反代）
 */
const getBaseUrl = (): string => {
  if (typeof window === "undefined") {
    return import.meta.env.VITE_SSR_API_BASE_URL || "http://localhost:8080/api/v1";
  }
  return import.meta.env.VITE_API_BASE_URL || "/api/v1";
};

/**
 * createHttpClient - 创建配好 interceptors 的 axios 实例
 *
 * SSR 时每个请求创建独立实例并注入 forwardedCookie，
 * 避免长驻进程跨请求 cookie 串扰。
 */
export const createHttpClient = (opts: HttpClientOptions = {}): AxiosInstance => {
  const client = axios.create({
    baseURL: opts.baseURL || getBaseUrl(),
    timeout: 15000,
    withCredentials: true, // 跨域携带 cookie（access/refresh/csrf 都在 cookie 里）
  });

  // SSR 转发 cookie header
  if (opts.forwardedCookie) {
    client.defaults.headers.common.Cookie = opts.forwardedCookie;
  }

  // 重试：仅网络错误 / 5xx，业务 4xx 不重试
  axiosRetry(client, {
    retries: 2,
    retryCondition: (err: AxiosError) => {
      if (err.code === "ERR_NETWORK" || err.code === "ETIMEDOUT") return true;
      const status = err.response?.status ?? 0;
      return status >= 500;
    },
    retryDelay: axiosRetry.exponentialDelay,
  });

  // request interceptor：注入 CSRF header
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getCSRFToken();
    if (token && config.method && config.method.toLowerCase() !== "get") {
      config.headers.set(CSRF_HEADER, token);
    }
    return config;
  });

  // response interceptor：解 envelope + 归一化错误 + 401 refresh
  client.interceptors.response.use(
    (response) => {
      const env = response.data as Envelope;
      const unpacked: UnpackedResponse = {
        data: env.data,
        pagination: env.meta?.pagination,
      };
      // 替换 response.data 为解包后的形态，业务层直接拿到 { data, pagination }
      response.data = unpacked;
      return response;
    },
    async (err: AxiosError<Envelope & { error?: string; message?: string; details?: Record<string, string[]>; request_id?: string }>) => {
      const status = err.response?.status ?? 0;

      // 401：触发 refresh（去重）后重放原请求
      if (status === 401 && !err.config?.__retried) {
        const ok = await triggerRefresh(async () => {
          try {
            await client.post("/auth/refresh", {}, { __retried: true } as Record<string, unknown>);
            return true;
          } catch {
            return false;
          }
        });
        if (ok) {
          err.config!.__retried = true;
          return client.request(err.config!);
        }
      }

      // 归一化错误
      const body = err.response?.data;
      if (body && body.error) {
        throw new ApiError({
          error: body.error,
          message: body.message ?? "请求失败",
          status,
          details: body.details,
          requestId: body.request_id,
        });
      }
      if (err.code === "ERR_NETWORK" || err.code === "ETIMEDOUT") {
        throw ApiError.network();
      }
      throw new ApiError({
        error: "UNKNOWN",
        message: err.message || "未知错误",
        status,
      });
    },
  );

  return client;
};

/** 客户端单例（SSR 不用此变量，每请求独立实例） */
export const httpClient = createHttpClient();
```

> 注：axios 的 `InternalAxiosRequestConfig` 在 v1.x 支持 `__retried` 自定义字段需要扩展类型。在 `tsconfig.app.json` 的 `compilerOptions.types` 里加上自定义声明，或用 `as` 转型。如果 TS 报错，把 `__retried` 改为声明扩展：
> ```ts
> declare module "axios" {
>   interface InternalAxiosRequestConfig {
>     __retried?: boolean;
>   }
> }
> ```
> 把这段加到 `http.ts` 顶部。

- [ ] **Step 7: 写 `shared/api/query-client.ts`**

`web/src/shared/api/query-client.ts`:
```ts
import { QueryClient, type QueryCacheConfig } from "@tanstack/react-query";

import { ApiError } from "./error";

/**
 * createQueryClient - 创建配置好的 QueryClient
 *
 * SSR 时每个请求创建独立实例（避免跨请求缓存串扰）。
 * 默认 staleTime 60s，业务错误不重试，仅网络错误重试。
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, err) => {
          // 业务错误（4xx）不重试
          if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
```

- [ ] **Step 8: 写 `shared/config/env.ts`（env 类型化）**

`web/src/shared/config/env.ts`:
```ts
/**
 * 环境变量类型化访问
 *
 * 所有 VITE_* 变量通过 import.meta.env 读取，TS 类型由 ImportMetaEnv 声明。
 */

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_SSR_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** 站点对外地址（SEO、OpenGraph） */
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? "http://localhost:5173";
```

- [ ] **Step 9: 类型检查**

```bash
cd web && pnpm tsc --noEmit
```

Expected: 零 error（如有 `__retried` 报错，按 Step 6 的 module declaration 修复）。

- [ ] **Step 10: Commit**

```bash
git add web/src/shared/
git commit -m "feat(web): shared/api 基础设施 - axios 封装 + CSRF + refresh 队列"
```

---

## Task 5: shared/server（SSR 鉴权转发）

**Files:**
- Create: `web/src/shared/server/cookies.ts`
- Create: `web/src/shared/server/auth.ts`
- Create: `web/src/shared/server/session.ts`

- [ ] **Step 1: 写 `server/cookies.ts`（SSR 端读入口请求 cookie）**

`web/src/shared/server/cookies.ts`:
```ts
import { getRequestHeaders } from "@tanstack/react-start/server";

/**
 * getForwardedCookie - 从 SSR 入口请求读取 cookie header
 *
 * SSR server 端调用后端 API 时，需要把浏览器发来的 cookie 原样转发，
 * 让后端 auth middleware 从 cookie 读 access token 鉴权。
 *
 * @returns 完整的 Cookie header 字符串（如 "mimo_access=xxx; mimo_csrf=yyy"）
 */
export const getForwardedCookie = (): string => {
  const headers = getRequestHeaders("cookie");
  return headers ?? "";
};
```

- [ ] **Step 2: 写 `server/auth.ts`（创建请求作用域 axios 实例）**

`web/src/shared/server/auth.ts`:
```ts
import type { AxiosInstance } from "axios";

import { createHttpClient } from "../api/http";
import { getForwardedCookie } from "./cookies";

/**
 * getServerHttpClient - 为当前 SSR 请求创建独立 axios 实例
 *
 * Node server 是长驻进程，全局 axios 实例的 interceptor 闭包会跨请求串扰，
 * 因此每请求创建独立实例并注入该请求的 cookie header。
 *
 * 必须在 server function / loader 内调用，不能在模块顶层缓存。
 */
export const getServerHttpClient = (): AxiosInstance =>
  createHttpClient({ forwardedCookie: getForwardedCookie() });
```

- [ ] **Step 3: 写 `server/session.ts`（getCurrentUser）**

`web/src/shared/server/session.ts`:
```ts
import type { Envelope } from "../api/types";
import type { UserDTO } from "../../entities/user/model/types";
import { getServerHttpClient } from "./auth";

/**
 * getCurrentUser - SSR 期间获取当前登录用户
 *
 * 转发浏览器 cookie 到后端 GET /auth/me：
 * - cookie 有效 → 返回 UserDTO
 * - cookie 无效/缺失 → 返回 null（不抛错，让页面正常渲染游客视图）
 *
 * 用于 __root 的 beforeLoad 注入 context.auth。
 */
export const getCurrentUser = async (): Promise<UserDTO | null> => {
  try {
    const client = getServerHttpClient();
    const res = await client.get<Envelope<UserDTO>>("/auth/me");
    return res.data.data;
  } catch {
    // 401 或网络错误都视为未登录，SSR 不能因鉴权失败导致整页 500
    return null;
  }
};
```

- [ ] **Step 4: 创建 `entities/user/model/types.ts`（被 session.ts 引用）**

`web/src/entities/user/model/types.ts`:
```ts
/**
 * UserDTO - 后端 /auth/me 返回的用户对象（对接 auth_queries.go UserDTO）
 */
export interface UserDTO {
  /** 用户 ID（UUID 字符串） */
  id: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email: string;
  /** 头像 URL */
  avatar_url: string;
  /** 个人简介 */
  bio: string;
  /** 角色：user / admin / superadmin */
  role: UserRole;
  /** 邮箱是否已验证 */
  email_verified: boolean;
  /** 账户是否启用 */
  is_active: boolean;
  /** 创建时间（RFC3339） */
  created_at: string;
  /** 权限码列表（仅当后端返回时存在） */
  permissions?: string[];
}

/** 用户角色枚举 */
export type UserRole = "user" | "admin" | "superadmin";
```

- [ ] **Step 5: 类型检查**

```bash
cd web && pnpm tsc --noEmit
```

Expected: 零 error。

- [ ] **Step 6: Commit**

```bash
git add web/src/shared/server/ web/src/entities/
git commit -m "feat(web): shared/server SSR 鉴权转发 + UserDTO 类型"
```

---

## Task 6: app 入口（router + provider + context）

**Files:**
- Modify: `web/src/app/router.tsx`（CLI 生成，需要加 context）
- Modify: `web/src/app/provider.tsx`（或 `client.tsx`）
- Modify: `web/src/routes/__root.tsx`（注入 context.auth）

- [ ] **Step 1: 写 `app/router.tsx`（含 RouterContext 类型）**

`web/src/app/router.tsx`（覆盖 CLI 生成版本）：
```tsx
import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { routeTree } from "../routeTree.gen";
import type { UserDTO } from "../entities/user/model/types";

/**
 * RouterContext - 全路由共享的上下文
 *
 * queryClient：SSR 每请求独立实例（在 __root beforeLoad 创建）
 * auth：SSR 期间确定的鉴权快照，client hydrate 时复用
 */
export interface RouterContext {
  queryClient: QueryClient;
  auth: {
    isAuthenticated: boolean;
    user: UserDTO | null;
  };
}

/**
 * createRouter - 创建 TanStack Router 实例
 *
 * context 初始为 undefined，由 __root 的 beforeLoad 在 SSR/client 启动时填充。
 */
export const createRouter = () =>
  createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    context: {
      queryClient: undefined!,
      auth: { isAuthenticated: false, user: null },
    },
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
```

- [ ] **Step 2: 写 `app/provider.tsx`（QueryClient + ThemeProvider + Toaster）**

`web/src/app/provider.tsx`:
```tsx
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@shared/ui/sonner";

import { createQueryClient } from "../shared/api/query-client";

const queryClient = createQueryClient();

/**
 * AppProvider - 全局 Provider 装配
 *
 * QueryClientProvider：服务端状态
 * ThemeProvider（next-themes）：双主题，cookie 持久化防 FOUC
 * Toaster：全局错误/成功 toast
 */
const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange>
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default AppProvider;
```

- [ ] **Step 3: 写 `routes/__root.tsx`（注入 context + 全局布局骨架）**

`web/src/routes/__root.tsx`（覆盖 CLI 生成版本，先放最小骨架，Header/Footer 等组件后续 Task 装配）：
```tsx
import { Outlet, ScrollRestoration, createRootRouteWithContext } from "@tanstack/react-router";

import type { RouterContext } from "../app/router";
import { getCurrentUser } from "../shared/server/session";
import { createQueryClient } from "../shared/api/query-client";

/**
 * __root - 根路由，所有路由共享
 *
 * beforeLoad 在 SSR 和 client 启动时填充 context：
 * - 每请求独立 queryClient（避免跨请求缓存串扰）
 * - 调 getCurrentUser() 转发 cookie 确定鉴权状态
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const queryClient = createQueryClient();
    const user = await getCurrentUser();
    return {
      queryClient,
      auth: {
        isAuthenticated: user !== null,
        user,
      },
    };
  },
  component: RootComponent,
});

const RootComponent = () => {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
};
```

- [ ] **Step 4: 验证 SSR 启动**

```bash
cd web && pnpm dev
```

Expected: 浏览器打开 `http://localhost:5173`，无报错。SSR 日志显示 `getCurrentUser()` 被调用（即使返回 null，因为没登录）。

- [ ] **Step 5: Commit**

```bash
git add web/src/app/ web/src/routes/__root.tsx
git commit -m "feat(web): app 入口 - RouterContext + Provider + __root SSR 鉴权"
```

---

## Task 7: features/posts（首页文章列表）

**Files:**
- Create: `web/src/features/posts/api/keys.ts`
- Create: `web/src/features/posts/api/queries.ts`
- Create: `web/src/features/posts/model/types.ts`
- Create: `web/src/features/posts/ui/PostCard.tsx`
- Create: `web/src/features/posts/ui/PostList.tsx`

- [ ] **Step 1: 写 `features/posts/model/types.ts`**

`web/src/features/posts/model/types.ts`:
```ts
/**
 * Post - 文章摘要（首页列表用）
 *
 * 对接后端 GET /api/v1/posts 返回字段（post 模块的 list DTO）。
 */
export interface Post {
  /** 文章 ID */
  id: string;
  /** slug（用于 URL） */
  slug: string;
  /** 标题 */
  title: string;
  /** 摘要 */
  excerpt: string;
  /** 封面图 URL */
  cover_image: string;
  /** 浏览量 */
  view_count: number;
  /** 发布时间（RFC3339） */
  published_at: string;
  /** 标签名列表 */
  tags: string[];
  /** 作者信息 */
  author: {
    username: string;
    avatar_url: string;
  };
}

/** 文章列表查询参数 */
export interface PostListQuery {
  /** 页码 */
  page?: number;
  /** 每页条数 */
  limit?: number;
  /** 标签筛选 */
  tag?: string;
}
```

- [ ] **Step 2: 写 `features/posts/api/keys.ts`**

`web/src/features/posts/api/keys.ts`:
```ts
import type { PostListQuery } from "../model/types";

/**
 * postKeys - 文章查询的 query key 工厂
 *
 * 用工厂模式集中管理 key，避免散落字符串导致缓存失效不彻底。
 */
export const postKeys = {
  /** 文章模块根 key */
  all: ["posts"] as const,
  /** 文章列表 */
  lists: () => [...postKeys.all, "list"] as const,
  /** 具体列表查询 */
  list: (query: PostListQuery) => [...postKeys.lists(), query] as const,
  /** 文章详情 */
  details: () => [...postKeys.all, "detail"] as const,
  /** 具体文章详情 */
  detail: (slug: string) => [...postKeys.details(), slug] as const,
};
```

- [ ] **Step 3: 写 `features/posts/api/queries.ts`**

`web/src/features/posts/api/queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";

import { httpClient } from "@shared/api/http";
import type { PagedResponse } from "@shared/api/types";

import { postKeys } from "./keys";
import type { Post, PostListQuery } from "../model/types";

/**
 * fetchPosts - 调后端 GET /api/v1/posts 拉取已发布文章列表
 *
 * @param query 分页与标签筛选
 */
export const fetchPosts = async (query: PostListQuery = {}): Promise<PagedResponse<Post>> => {
  const res = await httpClient.get<PagedResponse<Post>>("/posts", { params: query });
  return res.data;
};

/**
 * usePosts - 文章列表 hook
 *
 * 自动：
 * - 缓存（key 由 query 参数决定）
 * - 网络错误重试 2 次（QueryClient 默认）
 * - staleTime 60s（QueryClient 默认）
 */
export const usePosts = (query: PostListQuery = {}) =>
  useQuery({
    queryKey: postKeys.list(query),
    queryFn: () => fetchPosts(query),
  });
```

- [ ] **Step 4: 写 `features/posts/ui/PostCard.tsx`**

`web/src/features/posts/ui/PostCard.tsx`:
```tsx
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

import type { Post } from "../model/types";

/**
 * PostCardProps - PostCard 组件属性
 */
export interface PostCardProps {
  /**
   * 文章数据
   */
  post: Post;
}

/**
 * PostCard - 文章卡片
 *
 * 用于首页文章列表的单条展示。
 * 支持：
 * - 封面图懒加载
 * - Hover 动画
 * - 标签徽章
 * - 相对时间
 */
const PostCard = ({ post }: PostCardProps) => {
  return (
    <article className="group rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-lg">
      {post.cover_image && (
        <Link to="/blog/$slug" params={{ slug: post.slug }}>
          <img
            src={post.cover_image}
            alt={post.title}
            loading="lazy"
            className="w-full h-48 object-cover transition-transform group-hover:scale-105"
          />
        </Link>
      )}
      <div className="p-5">
        <div className="flex gap-2 mb-2">
          {post.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-lg font-semibold mb-2 line-clamp-2">
          <Link to="/blog/$slug" params={{ slug: post.slug }} className="hover:text-primary">
            {post.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{post.author.username}</span>
          <time>
            {formatDistanceToNow(new Date(post.published_at), { addSuffix: true, locale: zhCN })}
          </time>
        </div>
      </div>
    </article>
  );
};

export default PostCard;
```

- [ ] **Step 5: 写 `features/posts/ui/PostList.tsx`**

`web/src/features/posts/ui/PostList.tsx`:
```tsx
import { Skeleton } from "@ui/skeleton";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";

/**
 * PostListProps - PostList 组件属性
 */
export interface PostListProps {
  /**
   * 分页与标签筛选
   */
  query?: PostListQuery;
  /**
   * 是否显示加载骨架
   * @default true
   */
  showSkeleton?: boolean;
}

/**
 * PostList - 文章列表
 *
 * 自动：
 * - Skeleton 加载态
 * - 错误态
 * - 空态
 */
const PostList = ({ query = {}, showSkeleton = true }: PostListProps) => {
  const { data, isLoading, isError, error } = usePosts(query);

  if (isLoading && showSkeleton) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: query.limit ?? 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-center text-muted-foreground py-12">
        加载失败：{(error as Error).message}
      </p>
    );
  }

  if (!data?.data?.length) {
    return <p className="text-center text-muted-foreground py-12">暂无文章</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
};

export default PostList;
```

- [ ] **Step 6: 类型检查**

```bash
cd web && pnpm tsc --noEmit
```

Expected: 零 error。

- [ ] **Step 7: Commit**

```bash
git add web/src/features/posts/
git commit -m "feat(web): features/posts 文章列表模块"
```

---

## Task 8: features/github（贡献图）+ features/settings（站点信息）

**Files:**
- Create: `web/src/features/github/model/types.ts`
- Create: `web/src/features/github/api/keys.ts`
- Create: `web/src/features/github/api/queries.ts`
- Create: `web/src/features/github/ui/Contributions.tsx`
- Create: `web/src/features/settings/model/types.ts`
- Create: `web/src/features/settings/api/keys.ts`
- Create: `web/src/features/settings/api/queries.ts`

- [ ] **Step 1: 写 `features/github/model/types.ts`**

`web/src/features/github/model/types.ts`:
```ts
/**
 * Contribution - 单日 GitHub 贡献
 */
export interface Contribution {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日提交数 */
  count: number;
  /** 强度等级 0-4 */
  level: 0 | 1 | 2 | 3 | 4;
}

/**
 * ContributionSummary - 贡献图数据
 *
 * 对接后端 GET /api/v1/github/contributions。
 */
export interface ContributionSummary {
  /** 按日的贡献列表 */
  contributions: Contribution[];
  /** 总提交数 */
  total: number;
  /** 当前连续天数 */
  currentStreak: number;
}
```

- [ ] **Step 2: 写 `features/github/api/keys.ts`**

`web/src/features/github/api/keys.ts`:
```ts
export const githubKeys = {
  all: ["github"] as const,
  contributions: () => [...githubKeys.all, "contributions"] as const,
  repos: () => [...githubKeys.all, "repos"] as const,
};
```

- [ ] **Step 3: 写 `features/github/api/queries.ts`**

`web/src/features/github/api/queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";

import { httpClient } from "@shared/api/http";

import { githubKeys } from "./keys";
import type { ContributionSummary } from "../model/types";

/**
 * fetchContributions - 调 GET /api/v1/github/contributions
 *
 * 后端持有 GitHub token，前端无需传凭证。
 */
export const fetchContributions = async (): Promise<ContributionSummary> => {
  const res = await httpClient.get<{ data: ContributionSummary }>("/github/contributions");
  return res.data.data;
};

/**
 * useContributions - GitHub 贡献图 hook
 *
 * 缓存 5 分钟（贡献数据更新频率低）
 */
export const useContributions = () =>
  useQuery({
    queryKey: githubKeys.contributions(),
    queryFn: fetchContributions,
    staleTime: 5 * 60 * 1000,
  });
```

- [ ] **Step 4: 写 `features/github/ui/Contributions.tsx`（最简实现）**

`web/src/features/github/ui/Contributions.tsx`:
```tsx
import { useContributions } from "../api/queries";

/** 贡献强度对应的色阶（暗/亮主题由 CSS 变量驱动） */
const LEVEL_COLORS = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/70",
  "bg-primary",
];

/**
 * Contributions - GitHub 贡献热力图
 *
 * 支持：
 * - Skeleton
 * - 错误降级（贡献图失败不影响整页）
 */
const Contributions = () => {
  const { data, isLoading, isError } = useContributions();

  if (isLoading) {
    return <div className="h-32 rounded-lg bg-muted animate-pulse" />;
  }
  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">贡献图加载失败</p>;
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        过去一年共 {data.total} 次贡献
      </p>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {data.contributions.map((c) => (
          <div
            key={c.date}
            title={`${c.date}: ${c.count} 次`}
            className={`w-3 h-3 rounded-sm ${LEVEL_COLORS[c.level]}`}
          />
        ))}
      </div>
    </div>
  );
};

export default Contributions;
```

- [ ] **Step 5: 写 `features/settings/model/types.ts`**

`web/src/features/settings/model/types.ts`:
```ts
/**
 * SiteSettings - 站点公开设置
 *
 * 对接后端 GET /api/v1/settings（公开子集）。
 */
export interface SiteSettings {
  /** 站点名称 */
  siteName: string;
  /** 站点描述 */
  description: string;
  /** 站长昵称 */
  authorName: string;
  /** 站长签名/标语 */
  tagline: string;
  /** 社交链接 */
  socials: {
    github?: string;
    twitter?: string;
    email?: string;
  };
}

/**
 * Announcement - 公告
 *
 * 对接后端 GET /api/v1/announcements。
 */
export interface Announcement {
  id: string;
  /** 公告内容（Markdown） */
  content: string;
  /** 是否置顶 */
  pinned: boolean;
  /** 创建时间 RFC3339 */
  created_at: string;
}
```

- [ ] **Step 6: 写 `features/settings/api/keys.ts` + `queries.ts`**

`web/src/features/settings/api/keys.ts`:
```ts
export const settingsKeys = {
  all: ["settings"] as const,
  public: () => [...settingsKeys.all, "public"] as const,
  announcements: () => [...settingsKeys.all, "announcements"] as const,
};
```

`web/src/features/settings/api/queries.ts`:
```ts
import { useQuery } from "@tanstack/react-query";

import { httpClient } from "@shared/api/http";

import { settingsKeys } from "./keys";
import type { Announcement, SiteSettings } from "../model/types";

/**
 * fetchSettings - 调 GET /api/v1/settings 拉取公开站点配置
 */
export const fetchSettings = async (): Promise<SiteSettings> => {
  const res = await httpClient.get<{ data: SiteSettings }>("/settings");
  return res.data.data;
};

/** useSettings - 站点配置 hook，缓存 10 分钟（更新频率低） */
export const useSettings = () =>
  useQuery({
    queryKey: settingsKeys.public(),
    queryFn: fetchSettings,
    staleTime: 10 * 60 * 1000,
  });

/**
 * fetchAnnouncements - 调 GET /api/v1/announcements 拉取生效公告
 */
export const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const res = await httpClient.get<{ data: Announcement[] }>("/announcements");
  return res.data.data;
};

/** useAnnouncements - 公告 hook */
export const useAnnouncements = () =>
  useQuery({
    queryKey: settingsKeys.announcements(),
    queryFn: fetchAnnouncements,
  });
```

- [ ] **Step 7: 类型检查 + Commit**

```bash
cd web && pnpm tsc --noEmit
git add web/src/features/github/ web/src/features/settings/
git commit -m "feat(web): features/github + settings 模块"
```

---

## Task 9: features/music Zustand store

**Files:**
- Create: `web/src/features/music/model/ui-store.ts`

> 注：主题状态由 next-themes 接管（cookie 持久化 + SSR 防闪烁），不需要额外的 Zustand store。
> ThemeToggle 组件直接读写 `useTheme`（next-themes），避免双写导致状态不一致。

- [ ] **Step 1: 写 `features/music/model/ui-store.ts`**

`web/src/features/music/model/ui-store.ts`:
```ts
/**
 * Music UI Store - 音乐播放器显隐状态
 *
 * MusicPlayer 是常驻 __root 的全屏小组件（非路由），
 * 由 Header 的 nav action 项调用 openMusic() 切换。
 * 首期仅做骨架，实际播放下一期扩展。
 */
import { create } from "zustand";

export interface MusicUIState {
  /** 是否打开 */
  isOpen: boolean;
  /** 打开播放器 */
  open: () => void;
  /** 关闭播放器 */
  close: () => void;
  /** 切换显隐 */
  toggle: () => void;
}

export const useMusicUIStore = create<MusicUIState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
```

- [ ] **Step 2: Commit**

```bash
git add web/src/features/music/
git commit -m "feat(web): Zustand store - music UI 显隐状态"
```

---

## Task 10: widgets（Header / Footer / ThemeToggle / MusicPlayer / AnnouncementBar / Hero）

**Files:**
- Create: `web/src/shared/config/nav.ts`
- Create: `web/src/widgets/ThemeToggle/ThemeToggle.tsx` + `index.ts`
- Create: `web/src/widgets/Header/Header.tsx` + `HeaderLogo.tsx` + `HeaderNav.tsx` + `HeaderNavItem.tsx` + `HeaderActions.tsx` + `HeaderMobile.tsx` + `index.ts`
- Create: `web/src/widgets/Footer/Footer.tsx` + `index.ts`
- Create: `web/src/widgets/MusicPlayer/MusicPlayer.tsx` + `MusicPlayerEmpty.tsx` + `index.ts`
- Create: `web/src/widgets/AnnouncementBar/AnnouncementBar.tsx` + `index.ts`
- Create: `web/src/widgets/Hero/Hero.tsx` + `index.ts`

- [ ] **Step 1: 写 `shared/config/nav.ts`（nav 单一来源）**

`web/src/shared/config/nav.ts`:
```ts
/**
 * Nav 项定义（单一来源，Header 与移动端菜单共用）
 *
 * type 区分：
 * - route：路由跳转
 * - action：触发全局事件（如打开音乐播放器）
 */
export interface NavRouteItem {
  /** 类型标识 */
  type: "route";
  /** 显示文案 */
  label: string;
  /** 路由路径 */
  to: string;
}

export interface NavActionItem {
  type: "action";
  label: string;
  /** 动作标识，由消费方自行解释 */
  action: string;
}

export type NavItem = NavRouteItem | NavActionItem;

export const NAV_ITEMS: NavItem[] = [
  { type: "route", label: "首页", to: "/" },
  { type: "route", label: "博客", to: "/blog" },
  { type: "route", label: "关于", to: "/about" },
  { type: "route", label: "项目", to: "/projects" },
  { type: "action", label: "音乐", action: "open-music" },
];
```

- [ ] **Step 2: 写 `widgets/ThemeToggle/ThemeToggle.tsx`**

`web/src/widgets/ThemeToggle/ThemeToggle.tsx`:
```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@ui/button";

/**
 * ThemeToggle - 主题切换按钮
 *
 * 读写 next-themes（cookie 持久化），点击切换 light/dark。
 * 图标随当前主题切换 Sun/Moon。
 */
const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="切换主题"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
};

export default ThemeToggle;
```

- [ ] **Step 3: 写 Header 子组件（每个单文件）**

`web/src/widgets/Header/HeaderLogo.tsx`:
```tsx
import { Link } from "@tanstack/react-router";

import { useSettings } from "@features/settings/api/queries";

/**
 * HeaderLogo - 站名 logo
 *
 * 从站点配置读取名称，点击回首页。
 */
const HeaderLogo = () => {
  const { data } = useSettings();
  return (
    <Link to="/" className="text-xl font-bold tracking-tight">
      {data?.siteName ?? "Blog"}
    </Link>
  );
};

export default HeaderLogo;
```

`web/src/widgets/Header/HeaderNavItem.tsx`:
```tsx
import { Link } from "@tanstack/react-router";

import type { NavItem } from "@config/nav";

/**
 * HeaderNavItemProps
 */
export interface HeaderNavItemProps {
  /**
   * nav 项配置
   */
  item: NavItem;
  /**
   * 点击 action 项时的回调
   */
  onAction?: (action: string) => void;
}

/**
 * HeaderNavItem - 单个 nav 项
 *
 * 根据 item.type 渲染为 Link（route）或 button（action）。
 */
const HeaderNavItem = ({ item, onAction }: HeaderNavItemProps) => {
  if (item.type === "route") {
    return (
      <Link
        to={item.to}
        className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        activeProps={{ className: "text-foreground" }}
        activeOptions={{ exact: item.to === "/" }}
      >
        {item.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onAction?.(item.action)}
      className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {item.label}
    </button>
  );
};

export default HeaderNavItem;
```

`web/src/widgets/Header/HeaderNav.tsx`:
```tsx
import { NAV_ITEMS } from "@config/nav";
import HeaderNavItem from "./HeaderNavItem";

/**
 * HeaderNavProps
 */
export interface HeaderNavProps {
  /**
   * 点击 action 项时的回调
   */
  onAction?: (action: string) => void;
}

/**
 * HeaderNav - 桌面端 nav 列表
 */
const HeaderNav = ({ onAction }: HeaderNavProps) => {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV_ITEMS.map((item) => (
        <HeaderNavItem key={item.label} item={item} onAction={onAction} />
      ))}
    </nav>
  );
};

export default HeaderNav;
```

`web/src/widgets/Header/HeaderActions.tsx`:
```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "@ui/button";

import ThemeToggle from "../ThemeToggle/ThemeToggle";

/**
 * HeaderActions - 右侧操作区
 *
 * ThemeToggle + 登录按钮（首期仅占位，实际 auth 由后续 feature 接入）。
 */
const HeaderActions = () => {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <Button variant="ghost" size="sm" asChild>
        <Link to="/login">登录</Link>
      </Button>
    </div>
  );
};

export default HeaderActions;
```

`web/src/widgets/Header/HeaderMobile.tsx`:
```tsx
import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@ui/sheet";

import { NAV_ITEMS } from "@config/nav";
import HeaderNavItem from "./HeaderNavItem";

/**
 * HeaderMobileProps
 */
export interface HeaderMobileProps {
  /**
   * 点击 action 项时的回调
   */
  onAction?: (action: string) => void;
}

/**
 * HeaderMobile - 移动端汉堡菜单
 *
 * md 以下显示汉堡图标，点击展开 Sheet 抽屉显示 nav。
 */
const HeaderMobile = ({ onAction }: HeaderMobileProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开菜单">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <nav className="flex flex-col gap-2 mt-8">
          {NAV_ITEMS.map((item) => (
            <HeaderNavItem
              key={item.label}
              item={item}
              onAction={(a) => {
                onAction?.(a);
                setOpen(false);
              }}
            />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default HeaderMobile;
```

`web/src/widgets/Header/Header.tsx`:
```tsx
import { useMusicUIStore } from "@features/music/model/ui-store";

import HeaderActions from "./HeaderActions";
import HeaderLogo from "./HeaderLogo";
import HeaderMobile from "./HeaderMobile";
import HeaderNav from "./HeaderNav";

/**
 * Header - 页面顶部容器
 *
 * 装配 Logo + 桌面 Nav + 移动菜单 + 操作区。
 * action 项（音乐）派发到 MusicUIStore。
 */
const Header = () => {
  const openMusic = useMusicUIStore((s) => s.open);

  const handleAction = (action: string) => {
    if (action === "open-music") openMusic();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <HeaderLogo />
        <HeaderNav onAction={handleAction} />
        <div className="flex items-center gap-2">
          <HeaderActions />
          <HeaderMobile onAction={handleAction} />
        </div>
      </div>
    </header>
  );
};

export default Header;
```

`web/src/widgets/Header/index.ts`:
```ts
export { default } from "./Header";
```

- [ ] **Step 4: 写 `widgets/Footer/Footer.tsx`**

`web/src/widgets/Footer/Footer.tsx`:
```tsx
import { useSettings } from "@features/settings/api/queries";

/**
 * Footer - 页脚
 *
 * 显示站点名 + 社交链接（从站点配置读）。
 */
const Footer = () => {
  const { data } = useSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border mt-16">
      <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          © {year} {data?.siteName ?? "Blog"}
        </p>
        {data?.socials && (
          <div className="flex gap-4 text-sm text-muted-foreground">
            {data.socials.github && <a href={data.socials.github}>GitHub</a>}
            {data.socials.twitter && <a href={data.socials.twitter}>Twitter</a>}
            {data.socials.email && <a href={`mailto:${data.socials.email}`}>Email</a>}
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;
```

`web/src/widgets/Footer/index.ts`:
```ts
export { default } from "./Footer";
```

- [ ] **Step 5: 写 `widgets/MusicPlayer/MusicPlayerEmpty.tsx` + `MusicPlayer.tsx`**

`web/src/widgets/MusicPlayer/MusicPlayerEmpty.tsx`:
```tsx
import { Music } from "lucide-react";

/**
 * MusicPlayerEmpty - 无播放列表占位
 */
const MusicPlayerEmpty = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <Music className="h-12 w-12" />
      <p>暂无可用歌单</p>
    </div>
  );
};

export default MusicPlayerEmpty;
```

`web/src/widgets/MusicPlayer/MusicPlayer.tsx`:
```tsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@ui/button";
import { useMusicUIStore } from "@features/music/model/ui-store";

import MusicPlayerEmpty from "./MusicPlayerEmpty";

/**
 * MusicPlayer - 全屏音乐播放器组件
 *
 * 常驻 __root，通过 MusicUIStore 控显隐（非路由）。
 * 首期仅做骨架：打开/关闭 + 空态。
 * 实际播放（Plyr / 音频流）下一期扩展。
 *
 * 用 portal 挂到 body 避免 __root overflow 截断。
 */
const MusicPlayer = () => {
  const { isOpen, close } = useMusicUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto h-full flex flex-col px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">音乐</h2>
          <Button variant="ghost" size="icon" onClick={close} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <MusicPlayerEmpty />
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MusicPlayer;
```

`web/src/widgets/MusicPlayer/index.ts`:
```ts
export { default } from "./MusicPlayer";
```

- [ ] **Step 6: 写 `widgets/AnnouncementBar/AnnouncementBar.tsx`**

`web/src/widgets/AnnouncementBar/AnnouncementBar.tsx`:
```tsx
import { useAnnouncements } from "@features/settings/api/queries";

/**
 * AnnouncementBar - 公告条
 *
 * 显示生效公告（置顶优先），无公告时不渲染。
 */
const AnnouncementBar = () => {
  const { data } = useAnnouncements();

  if (!data?.length) return null;

  // 取置顶的第一条，否则第一条
  const top = data.find((a) => a.pinned) ?? data[0];

  return (
    <div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4">
      {top.content}
    </div>
  );
};

export default AnnouncementBar;
```

`web/src/widgets/AnnouncementBar/index.ts`:
```ts
export { default } from "./AnnouncementBar";
```

- [ ] **Step 7: 写 `widgets/Hero/Hero.tsx`**

`web/src/widgets/Hero/Hero.tsx`:
```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "@ui/button";

import { Aurora } from "@vendor/react-bits/backgrounds/Aurora";
import { GradientText } from "@vendor/react-bits/text-animations/GradientText";
import { DecryptedText } from "@vendor/react-bits/text-animations/DecryptedText";
import { useSettings } from "@features/settings/api/queries";

/**
 * Hero - 首页头部英雄区
 *
 * react-bits 三组件组合：
 * - Aurora：背景渐变
 * - GradientText：站名渐变文字
 * - DecryptedText：签名解密动画
 */
const Hero = () => {
  const { data } = useSettings();

  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 -z-10">
        <Aurora />
      </div>
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <GradientText>{data?.siteName ?? "Blog"}</GradientText>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-8">
          <DecryptedText text={data?.tagline ?? "Hello World"} />
        </p>
        <Button size="lg" asChild>
          <Link to="/blog">进入博客</Link>
        </Button>
      </div>
    </section>
  );
};

export default Hero;
```

`web/src/widgets/Hero/index.ts`:
```ts
export { default } from "./Hero";
```

- [ ] **Step 8: 类型检查**

```bash
cd web && pnpm tsc --noEmit
```

Expected: 零 error（react-bits 组件的实际 import 路径以 CLI 生成的为准，若路径不同需调整）。

- [ ] **Step 9: Commit**

```bash
git add web/src/widgets/ web/src/shared/config/nav.ts
git commit -m "feat(web): widgets - Header/Footer/MusicPlayer/AnnouncementBar/Hero/ThemeToggle"
```

---

## Task 11: 路由装配（首页 + 占位页 + __root 装配 widgets）

**Files:**
- Create: `web/src/shared/ui/coming-soon.tsx`
- Modify: `web/src/routes/__root.tsx`（装配 Header/Footer/MusicPlayer/AnnouncementBar）
- Modify: `web/src/routes/index.tsx`（首页）
- Create: `web/src/routes/blog/index.tsx`
- Create: `web/src/routes/about/index.tsx`
- Create: `web/src/routes/projects/index.tsx`
- Create: `web/src/routes/profile/index.tsx`
- Create: `web/src/routes/login.tsx`

- [ ] **Step 1: 写 `shared/ui/coming-soon.tsx`**

`web/src/shared/ui/coming-soon.tsx`:
```tsx
import { Link } from "@tanstack/react-router";
import { Button } from "@ui/button";

/**
 * ComingSoonProps
 */
export interface ComingSoonProps {
  /**
   * 页面标题（显示在主文案中）
   */
  title: string;
}

/**
 * ComingSoon - 占位页统一组件
 *
 * 用于 blog/about/projects/profile 等首期未实装的页面。
 * 显示页面标题 + 建设中文案 + 返回首页 CTA。
 */
const ComingSoon = ({ title }: ComingSoonProps) => {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-4xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground mb-8">建设中，敬请期待</p>
      <Button asChild>
        <Link to="/">返回首页</Link>
      </Button>
    </div>
  );
};

export default ComingSoon;
```

- [ ] **Step 2: 写首页 `routes/index.tsx`**

`web/src/routes/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

import Hero from "@widgets/Hero";
import PostList from "@features/posts/ui/PostList";
import Contributions from "@features/github/ui/Contributions";
import { githubKeys } from "@features/github/api/keys";
import { fetchContributions } from "@features/github/api/queries";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings, fetchAnnouncements } from "@features/settings/api/queries";

/**
 * 首页 - Hero + 最新 6 篇文章 + GitHub 贡献图
 *
 * loader SSR 并发预取三组数据，dehydrate 到 HTML，hydrate 后无额外请求。
 */
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: postKeys.list({ page: 1, limit: 6 }),
        queryFn: () => fetchPosts({ page: 1, limit: 6 }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: githubKeys.contributions(),
        queryFn: fetchContributions,
      }),
      context.queryClient.ensureQueryData({
        queryKey: settingsKeys.public(),
        queryFn: fetchSettings,
      }),
      context.queryClient.ensureQueryData({
        queryKey: settingsKeys.announcements(),
        queryFn: fetchAnnouncements,
      }),
    ]);
  },
  component: HomePage,
});

const HomePage = () => {
  return (
    <>
      <Hero />
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8">最新文章</h2>
        <PostList query={{ page: 1, limit: 6 }} />
      </section>
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold mb-8">GitHub 活动</h2>
        <Contributions />
      </section>
    </>
  );
};
```

- [ ] **Step 3: 写占位路由**

`web/src/routes/blog/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

import ComingSoon from "@shared/ui/coming-soon";

const BlogPage = () => <ComingSoon title="博客" />;

export const Route = createFileRoute("/blog/")({
  component: BlogPage,
});
```

`web/src/routes/about/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

import ComingSoon from "@shared/ui/coming-soon";

const AboutPage = () => <ComingSoon title="关于" />;

export const Route = createFileRoute("/about/")({
  component: AboutPage,
});
```

`web/src/routes/projects/index.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

import ComingSoon from "@shared/ui/coming-soon";

const ProjectsPage = () => <ComingSoon title="项目" />;

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});
```

`web/src/routes/login.tsx`:
```tsx
import { createFileRoute } from "@tanstack/react-router";

import ComingSoon from "@shared/ui/coming-soon";

const LoginPage = () => <ComingSoon title="登录" />;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
```

- [ ] **Step 4: 写 profile 路由（带 beforeLoad 守卫）**

`web/src/routes/profile/index.tsx`:
```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

import ComingSoon from "@shared/ui/coming-soon";

/**
 * /profile - 需登录
 *
 * beforeLoad 在 SSR 期间即可根据 context.auth 重定向，
 * 不必等 client hydrate 才发现未登录。
 * 首期是占位页，但鉴权流要实装作为后续模板。
 */
export const Route = createFileRoute("/profile/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },
  component: ProfilePage,
});

const ProfilePage = () => <ComingSoon title="个人中心" />;
```

- [ ] **Step 5: 修改 `__root.tsx` 装配 widgets**

`web/src/routes/__root.tsx`（在 Task 6 基础上加入 widgets）：
```tsx
import { Outlet, ScrollRestoration, createRootRouteWithContext } from "@tanstack/react-router";

import type { RouterContext } from "../app/router";
import { getCurrentUser } from "../shared/server/session";
import { createQueryClient } from "../shared/api/query-client";
import AnnouncementBar from "@widgets/AnnouncementBar";
import Header from "@widgets/Header";
import Footer from "@widgets/Footer";
import MusicPlayer from "@widgets/MusicPlayer";

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const queryClient = createQueryClient();
    const user = await getCurrentUser();
    return {
      queryClient,
      auth: {
        isAuthenticated: user !== null,
        user,
      },
    };
  },
  component: RootComponent,
});

const RootComponent = () => {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="min-h-[60vh]">
        <Outlet />
      </main>
      <Footer />
      <MusicPlayer />
      <ScrollRestoration />
    </>
  );
};
```

- [ ] **Step 6: 验证启动 + 双主题 + 数据拉取**

```bash
cd web && pnpm dev
```

Expected（需后端 `make dev` 同步运行在 8080）：
- 首页显示 Hero + 6 篇文章卡片 + 贡献图
- Header 显示 5 个 nav 项，点击"音乐"打开全屏播放器
- 占位页 `/blog` `/about` `/projects` 显示 ComingSoon
- 主题切换按钮工作，刷新页面无 FOUC

- [ ] **Step 7: Commit**

```bash
git add web/src/routes/ web/src/shared/ui/coming-soon.tsx
git commit -m "feat(web): 路由装配 - 首页 + 占位页 + __root widgets"
```

---

## Task 12: 守护脚本（一文件一组件 / Props JSDoc / 文件长度）

**Files:**
- Create: `scripts/check-component-size.ts`
- Create: `scripts/check-single-component.ts`
- Create: `scripts/check-props-jsdoc.ts`

- [ ] **Step 1: 写 `scripts/check-single-component.ts`（一文件一组件）**

`scripts/check-single-component.ts`（放在 repo 根 `scripts/`，**不在 web/ 内**）:
```ts
/**
 * 守护脚本：每个 .tsx 文件（排除 vendor/app/routes）只能有 1 个组件
 *
 * 检测方式：用正则匹配组件定义特征（function Xxx / const Xxx = () =>），
 * 第三方组件库（radix/react-bits/shadcn）不受此限制（已在路径排除）。
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const EXCLUDE = ["src/shared/vendor/", "src/routeTree.gen.ts", "src/app/"];

const files = execSync("git ls-files 'web/src/**/*.tsx'", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter((f) => !EXCLUDE.some((e) => f.includes(e)));

let errors = 0;
for (const file of files) {
  const content = readFileSync(file, "utf-8");
  // 匹配 PascalCase 命名的组件定义
  const componentDefs =
    content.match(/\b(?:const|function)\s+([A-Z][a-zA-Z0-9]+)\s*(?:=|\()/g) ?? [];
  if (componentDefs.length > 1) {
    console.error(`✗ ${file}: 检测到 ${componentDefs.length} 个组件（应仅 1 个）`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n共 ${errors} 个文件违反"一文件一组件"规则`);
  process.exit(1);
}
console.log("✓ 一文件一组件检查通过");
```

- [ ] **Step 2: 写 `scripts/check-component-size.ts`（文件长度）**

`scripts/check-component-size.ts`:
```ts
/**
 * 守护脚本：组件文件长度限制
 *
 * 规则：
 * - pages/**、routes/**：≤ 400 行
 * - widgets/**：≤ 250 行
 * - 其他 .tsx：≤ 150 行
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const LIMITS: Array<{ pattern: string; max: number; label: string }> = [
  { pattern: "src/routes/", max: 400, label: "路由文件" },
  { pattern: "src/widgets/", max: 250, label: "widget 组件" },
  { pattern: ".tsx", max: 150, label: "普通组件" },
];

const EXCLUDE = ["src/shared/vendor/", "src/routeTree.gen.ts"];

const files = execSync("git ls-files 'web/src/**/*.tsx'", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter((f) => !EXCLUDE.some((e) => f.includes(e)));

let errors = 0;
for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n").length;
  for (const { pattern, max, label } of LIMITS) {
    if (file.includes(pattern) && lines > max) {
      console.error(`✗ ${file}: ${lines} 行超过 ${label} 上限 ${max}`);
      errors++;
      break;
    }
  }
}

if (errors > 0) {
  console.error(`\n共 ${errors} 个文件超出长度限制`);
  process.exit(1);
}
console.log("✓ 文件长度检查通过");
```

- [ ] **Step 3: 写 `scripts/check-props-jsdoc.ts`（Props JSDoc）**

`scripts/check-props-jsdoc.ts`:
```ts
/**
 * 守护脚本：导出的 *Props interface 每字段必须有 JSDoc
 *
 * 检测方式：找到 export interface *Props 块，逐字段检查前一行是否有 /** 注释
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const EXCLUDE = ["src/shared/vendor/"];

const files = execSync("git ls-files 'web/src/**/*.tsx'", { encoding: "utf-8" })
  .trim()
  .split("\n")
  .filter((f) => !EXCLUDE.some((e) => f.includes(e)));

let errors = 0;
for (const file of files) {
  const lines = readFileSync(file, "utf-8").split("\n");
  let inProps = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^export\s+interface\s+\w*Props/.test(line.trim())) {
      inProps = true;
      continue;
    }
    if (inProps) {
      if (line.includes("}")) {
        inProps = false;
        continue;
      }
      // 字段行：缩进的 fieldName: type;
      const isField = /^\s+\w+\s*[?:].*;/.test(line);
      if (isField) {
        const prev = lines[i - 1].trim();
        if (!prev.startsWith("/**") && !prev.endsWith("*/")) {
          console.error(`✗ ${file}:${i + 1} 字段缺 JSDoc: ${line.trim()}`);
          errors++;
        }
      }
    }
  }
}

if (errors > 0) {
  console.error(`\n共 ${errors} 处 Props 字段缺 JSDoc`);
  process.exit(1);
}
console.log("✓ Props JSDoc 检查通过");
```

- [ ] **Step 4: 运行守护脚本验证**

```bash
tscrips scripts/*.ts  # 或 npx tsx scripts/check-*.ts
```

Expected: 三个脚本都输出 ✓。若有 ✗ 报错，按报错修复对应文件。

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "chore: 自定义守护脚本 - 一文件一组件/文件长度/Props JSDoc"
```

---

## Task 13: 端到端验证 + 验收清单

**Files:** 无新建，仅验证

- [ ] **Step 1: 启动后端**

```bash
cd /Users/sun/Developer/blog-project
make dev-api  # 或 cd api && go run ./cmd/server
```

Expected: 后端启动在 :8080，日志显示 Redis/DB 连接成功。

- [ ] **Step 2: 启动前端**

```bash
cd web && pnpm dev
```

- [ ] **Step 3: 逐项验收清单**

逐条核对 spec 第 10 节：

- [ ] 浏览器打开 `http://localhost:5173`，首页 SSR 预取 posts/github/settings 数据（无 loading 闪烁）
- [ ] 首页 Aurora 背景 + GradientText 站名 + DecryptedText 签名渲染正常
- [ ] 双主题切换工作（点击 Header 主题按钮），刷新页面无 FOUC
- [ ] Header nav 5 项：首页 / 博客 / 关于 / 项目 + 音乐（action），点击音乐触发 MusicPlayer 全屏
- [ ] 占位页 `/blog` `/about` `/projects` `/profile` 显示 ComingSoon
- [ ] `/profile` 未登录访问重定向到 `/login`
- [ ] DevTools Network 查看 API 请求：所有跨域请求携带 cookie（`withCredentials` 生效），写请求有 `X-CSRF-Token` header

- [ ] **Step 4: 代码质量检查**

```bash
cd web
pnpm tsc --noEmit          # 类型零 error
pnpm biome check .         # biome 零 error
node --loader tsx scripts/check-single-component.ts
node --loader tsx scripts/check-component-size.ts
node --loader tsx scripts/check-props-jsdoc.ts
```

Expected: 全部通过。

- [ ] **Step 5: 最终 Commit（如有微调）**

```bash
git add -A
git commit -m "chore(web): 首期 MVP 验收完成"
```

- [ ] **Step 6: 更新 spec 状态**

修改 `docs/superpowers/specs/2026-06-22-blog-frontend-design.md` 顶部：
```
> **状态**：已实现（首期 MVP）
```

Commit：
```bash
git add docs/superpowers/specs/
git commit -m "docs(spec): 标记首期 MVP 已实现"
```

---

## 自审清单（执行者核对）

实现完成后，对照 spec 自查：

1. **spec 第 1 节范围**：首页 + nav 骨架 + 全局组件全部实现？→ Task 7-11
2. **spec 第 3 节架构**：FSD 七层目录正确？单向依赖无违反？→ Task 4-11
3. **spec 第 4 节 API 层**：axios 统一封装？withCredentials + CSRF + refresh 队列？→ Task 4
4. **spec 第 5 节首页**：3 个 react-bits 组件？SSR 预取？→ Task 7-11
5. **spec 第 6 节全局组件**：Header/Footer/MusicPlayer/ThemeToggle/AnnouncementBar？→ Task 10
6. **spec 第 7 节 SSR 鉴权**：context.auth SSR 期间确定？profile beforeLoad 守卫？→ Task 5-6, 11
7. **spec 第 9 节代码规范**：所有组件有 JSDoc？Props 每字段 JSDoc？一文件一组件？文件长度？→ Task 12 守护脚本 + 写代码时遵守

---

## 执行选择

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-blog-frontend-mvp.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 每个 Task 派发独立 subagent，每个 Task 完成后审查，快速迭代

**2. Inline Execution** - 在当前会话用 executing-plans 批量执行，分批 checkpoint 审查

**Which approach?**
