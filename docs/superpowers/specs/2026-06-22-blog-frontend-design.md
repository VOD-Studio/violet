# 博客前端架构设计（v2.0）

> **状态**：已确认，待实现
> **日期**：2026-06-22
> **作者**：brainstorming session 产物
> **范围**：在 `web/` 原位重建 React 前端，首期实现首页 + nav 骨架，后续渐进扩展

---

## 1. 目标与范围

### 1.1 首期范围（最小 MVP）

- **首页 `/`**：Hero + 最新文章列表 + GitHub 贡献图 + Footer
- **Nav 骨架**：首页 / 博客 / 关于 / 项目（占位路由）+ 音乐（全屏小组件 action）
- **全局组件**：Header / Footer / MusicPlayer（骨架）/ ThemeToggle / AnnouncementBar / Toaster
- **鉴权契约**：与后端 cookie + CSRF 方案对接（后端已实装，见 commit `4a3f333` + `7899e79`）

### 1.2 不在首期范围

- 博客列表/详情、关于、项目详情页内容（占位即可）
- 音乐播放器实际播放逻辑（仅骨架）
- 评论、admin 后台、富文本编辑器
- 这些会在后续迭代按 feature 模块化扩展

### 1.3 后续扩展契约

所有占位路由用统一 `<ComingSoon/>` 组件，新增 feature 时遵循第 3 节的模块规范即可，**不需要修改架构**。

---

## 2. 技术栈

| 类别 | 选型 | 引入方式 |
|------|------|---------|
| 框架 | React 19 + TanStack Start（SSR） | npm 依赖 |
| 路由 | TanStack Router（文件路由） | npm 依赖 |
| 服务端状态 | TanStack Query v5 | npm 依赖 |
| 全局客户端状态 | Zustand v5 | npm 依赖 |
| HTTP 客户端 | axios + axios-retry | npm 依赖，统一封装 |
| 样式 | Tailwind CSS v4 + CSS 变量双主题 | `@tailwindcss/vite` |
| 交互组件库 | shadcn/ui（copy-paste） | `shadcn@latest add` CLI |
| 动画/视觉组件 | react-bits（copy-paste） | `shadcn@latest add "@react-bits/*-TS-TW"` CLI |
| 底层原语 | Radix UI | shadcn add 时隐式拉取 |
| 表单 | React Hook Form + Zod v4 | npm 依赖 |
| 主题 | next-themes（防 FOUC） | npm 依赖 |
| 代码检查 | Biome v2 | devDependency |
| 测试 | Vitest + Testing Library | devDependency |
| 包管理器 | pnpm | — |
| Node | 22 LTS | `.nvmrc` |

**Radix 原语禁止直接 import `@radix-ui/*`**，一律经 shadcn 封装。

### 2.1 react-bits slug 规范

所有 react-bits 组件通过 shadcn CLI 引入，slug 必须带 **`-TS-TW`** 后缀（TypeScript + Tailwind v4 变体）：

```bash
pnpm dlx shadcn@latest add "@react-bits/Aurora-TS-TW"
pnpm dlx shadcn@latest add "@react-bits/GradientText-TS-TW"
```

### 2.2 AI 配套引入

- 各库的 `llms.txt` / `llms-full.txt` 拉到 `web/.ai/<lib>/`，供 LLM agent 读取
- 站点根 `public/llms.txt` 输出一份（首期可只列文章索引）
- `components.json` 配置 aliases，让 CLI 自动落到正确目录（见 3.2）

---

## 3. 架构与目录结构

### 3.1 FSD 七层

```
web/src/
├── app/              TanStack Start 入口（router/client/ssr/api/provider）
├── routes/           文件路由（薄：loader + 装配 widget）
├── widgets/          复合组件（Header/Footer/MusicPlayer/ThemeToggle）
├── features/         业务模块（api/model/ui 三段式）
├── entities/         跨模块领域对象（user/post 核心类型）
└── shared/           跨切面基础设施（详见 3.3）
```

**单向依赖规则**（硬约束，由 biome + 自定义脚本守护）：

```
routes ─→ widgets ─→ features ─→ entities ─→ shared
                                     │
                                     └─→ shared/api（httpClient）

禁止：
  - feature → feature（跨模块复用走 entities 或 widgets）
  - 任何层 → routes（路由是装配点，不被引用）
  - shared → features（底层不依赖业务）
  - ui/ → 直接 import httpClient（必须经 api/ 的 hook）
```

### 3.2 components.json（shadcn/react-bits CLI）

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

### 3.3 shared 层内部结构

```
shared/
├── api/
│   ├── http.ts               axios 实例 + interceptors
│   ├── refresh-queue.ts      401 并发队列
│   ├── csrf.ts               读 mimo_csrf cookie → 注入 header
│   ├── error.ts              ApiError + 错误码常量
│   ├── query-client.ts       QueryClient + 默认配置
│   └── types.ts              Envelope、Pagination、ApiErrorCode、ImportMetaEnv
├── server/                   SSR 服务端专用（绝不进 client bundle）
│   ├── auth.ts               从请求上下文取 cookie，注入 axios
│   ├── session.ts            SSR 会话状态（getCurrentUser）
│   ├── cookies.ts            双端 cookie 读写封装
│   └── seo.ts                meta tags / OpenGraph / StructuredData
├── ui/                       shadcn 原子（button/dialog/input/...）
├── vendor/
│   └── react-bits/           reactbits.dev 拷贝下来的组件
├── lib/                      cn、日期、格式化等纯函数
└── config/                   env、常量、nav 配置
    └── nav.ts                nav 项定义（route/action 两种类型）
```

**关键规则**：
- `shared/server/*` 通过 biome `noRestrictedImports` 守护，客户端代码 import 会报错
- `shared/types.ts` 是纯类型聚合（零运行时代码）
- vendored 只在 `shared/vendor/`，根目录**禁止**出现 `components/`
- `shared/vendor/react-bits/` 可引用 `@shared/ui` 与 `@shared/types`，不反向依赖

### 3.4 导入别名（tsconfig.json paths）

```jsonc
{
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
```

### 3.5 Feature 模块内部三段式

每个 `features/<x>/` 严格遵守：

```
features/posts/
├── api/        数据访问：httpClient + query keys + hooks
│   ├── queries.ts        usePosts / usePost + loader helpers
│   ├── mutations.ts      useIncrementView
│   └── keys.ts           postKeys 工厂
├── model/      纯数据：types + zod schema（无副作用）
│   ├── types.ts
│   └── schema.ts
└── ui/         React 组件（只 import 本 feature 的 api/model + shared）
    ├── PostCard.tsx
    └── PostList.tsx
```

**跨 feature 复用规则**：类型/纯数据 → 提升到 `entities/`；复合 UI → 提升到 `widgets/`。

---

## 4. 数据流与 API 层（统一封装）

**所有页面/组件禁止直接调用 fetch/axios**，只能通过 feature 暴露的 hooks 或 `httpClient` 间接使用。

### 4.1 封装架构

```
组件/hooks
    │  只调用 features/*/api 或 shared/api
    ▼
httpClient（统一出口）─── axios 实例
    │
    ├─ request interceptor
    │    ├─ withCredentials: true（跨域携带 cookie）
    │    ├─ 读 mimo_csrf cookie → 注入 X-CSRF-Token header
    │    └─ 注入 X-Request-Id（SSR 端追踪）
    ├─ response interceptor（成功）
    │    └─ 拆 envelope：res.data.data 当 payload、res.data.meta.pagination 单独返回
    ├─ auth refresh
    │    ├─ 401 → POST /auth/refresh（cookie 自动携带，无需 body）
    │    ├─ 所有并发 401 进同一 promise 队列
    │    └─ refresh 成功 → 重放原请求；失败 → 跳 /login + toast
    ├─ error handling
    │    └─ → ApiError(code, message, details, status)
    └─ retry
         └─ axios-retry：仅 ERR_NETWORK/ETIMEDOUT/5xx，最多 2 次指数退避
            4xx 业务错误不重试
```

### 4.2 Token 与 CSRF 流转（双 token 都入 HttpOnly cookie）

**后端契约（已实装）**：
- access + refresh 都通过 HttpOnly cookie 下发（JS 不可读，防 XSS 偷取）
- CSRF double-submit：后端设非 HttpOnly 的 `mimo_csrf` cookie，前端读后回传 `X-CSRF-Token` header
- `POST /auth/csrf-token` 提供初始 token（未登录用户先调此端点才能 login）

**前端职责**：
- axios `withCredentials: true`（跨域携带 cookie）
- request interceptor 自动读 `mimo_csrf` cookie 注入 `X-CSRF-Token` header
- **不持有任何 token 字符串**——完全由浏览器 cookie 机制管理
- 401 时调 `POST /auth/refresh`（无 body），后端下发新 cookie，重放原请求
- 登出：`POST /auth/logout`，后端清除 cookie + blacklist refresh

### 4.3 SSR 与 axios baseURL

axios 在 server 端需要绝对 URL（不能相对 `/api/v1`）。封装 `getBaseUrl()`：
- 服务端：从 `VITE_SSR_API_BASE_URL` 读内网地址（如 `http://api:8080/api/v1`）
- 客户端：相对 `/api/v1`，走浏览器同源

SSR server 端的 axios 实例：
- `withCredentials: true`
- 从入口请求转发 `cookie` header 到后端 API（后端 auth middleware 已支持 cookie 读取）
- 无需手动换 access token —— 直接转发浏览器 cookie 即可

### 4.4 对外暴露面

仅三个：
- `httpClient`（feature api 文件用）
- `ApiError`（错误处理用）
- feature hooks（页面/组件用）

页面组件**只 import feature hooks**，永远不直接 import `httpClient` 或 axios。

### 4.5 错误归一化

```ts
// shared/api/error.ts
export interface ApiErrorShape {
  code: string              // 机器码：NOT_FOUND / UNAUTHORIZED / FORBIDDEN / INTERNAL_ERROR
  message: string           // 人类可读
  details?: Record<string, string[]>  // 字段级校验错误
  status: number            // HTTP 状态码
  requestId?: string
}
```

全局 `QueryCache` / `MutationCache` 订阅 error → toast；业务页可 try/catch feature hook 抛出的 `ApiError` 做细粒度处理。

---

## 5. 首页实现

### 5.1 组件树

```
<Index>                                  routes/index.tsx
├─ <Hero>                                widgets/Hero
│   ├─ <Aurora/>                         @vendor/react-bits
│   ├─ <GradientText>博客名</GradientText>
│   ├─ <DecryptedText>签名</DecryptedText>
│   └─ <CTAButton>进入博客</CTAButton>    @ui/button 包裹
├─ <RecentPosts>                         features/posts/ui/RecentPosts
│   └─ <PostCard/> × N
└─ <GithubContributions>                 features/github/ui/Contributions
```

### 5.2 SSR 并发预取

```ts
// routes/index.tsx
export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const [posts, github, settings] = await Promise.all([
      context.queryClient.ensureQueryData(postKeys.list({ page: 1, limit: 6 })),
      context.queryClient.ensureQueryData(githubKeys.contributions()),
      context.queryClient.ensureQueryData(settingsKeys.public()),
    ])
    return { posts, github, settings }
  },
  component: IndexPage,
})
```

### 5.3 首页用到的后端接口

| 数据 | 接口 | feature |
|------|------|---------|
| 最新 6 篇文章 | `GET /api/v1/posts?page=1&limit=6` | `features/posts` |
| GitHub 贡献图 | `GET /api/v1/github/contributions` | `features/github` |
| 站点信息 + 公告 | `GET /api/v1/settings` + `GET /api/v1/announcements` | `features/settings` |

全部 public，SSR 直连。

### 5.4 react-bits 双主题适配

首页仅用 3 个 react-bits 组件（不堆砌）：`Aurora`、`GradientText`、`DecryptedText`。
所有组件的颜色**改用 CSS 变量** `hsl(var(--*))`，不用默认固定色值——切主题无需重渲染。

### 5.5 `__root.tsx` 布局

```
<RootDocument>
├─ <AnnouncementBar/>       公告条
├─ <Header/>                nav + ThemeToggle + 登录入口
├─ <Outlet/>                子路由
├─ <Footer/>
├─ <MusicPlayer/>           全屏小组件，默认隐藏，nav action 触发打开
└─ <Toaster/>               全局错误 toast
```

### 5.6 占位页

`/blog`、`/about`、`/projects`、`/profile` 用统一 `<ComingSoon/>` 组件（`shared/ui/coming-soon.tsx`）。

---

## 6. 全局组件 + 状态管理

### 6.1 Header / Nav（`widgets/Header/`）

```
widgets/Header/
├── Header.tsx              容器，装配子组件
├── HeaderLogo.tsx
├── HeaderNav.tsx           nav 列表，数据来自 @config/nav
├── HeaderNavItem.tsx       单项（route/action 两种类型）
├── HeaderActions.tsx       ThemeToggle + 登录入口
├── HeaderMobile.tsx        移动端 Sheet 菜单
└── index.ts
```

- nav 配置单一来源 `@config/nav.ts`，type 区分 `route` / `action`
- action 项（音乐）点击派发全局事件，不导航
- 当前激活路由高亮：TanStack Router `useMatchRoute` / `Link` 的 `activeProps`

### 6.2 MusicPlayer（`widgets/MusicPlayer/`）—— 全局全屏小组件

```
widgets/MusicPlayer/
├── MusicPlayer.tsx         容器，监听 musicUIStore.open
├── MusicPlayerFull.tsx     全屏完整播放器
├── MusicPlayerEmpty.tsx    无播放列表占位
└── index.ts
```

- **不是路由**，常驻 `__root.tsx`
- 通过 Zustand store 控显隐，nav 的 action 项调用 `openMusic()` 切换
- 用 `portal` 挂到 body 避免 `__root` overflow 截断
- **首期只做"打开/关闭 + 列表展示"骨架**，实际播放下一期扩展
- 数据：`GET /music/playlists/active` + `GET /music/settings`

### 6.3 ThemeToggle（`widgets/ThemeToggle/`）

- 双主题实现：`class` 策略挂在 `<html>`（`light`/`dark`）
- 由 `shared/lib/theme.ts` + next-themes 管理
- SSR 时从 cookie 读初始主题避免 FOUC

### 6.4 状态管理分层（强制职责分明）

| 状态类型 | 工具 | 例子 |
|---------|------|------|
| 局部 UI 状态 | `useState` | 输入框值、弹窗开关 |
| 全局客户端状态 | **Zustand** | 主题、MusicPlayer 开关、侧边栏 |
| 服务端数据 | **TanStack Query** | posts / github / settings / me |
| URL 状态 | TanStack Router `searchParams` | 博客列表的 page/tag 筛选 |

**禁止越界**：服务端数据绝不进 Zustand；UI 开关绝不进 Query。

**Zustand store 清单**（首期 2 个）：

> 注：客户端不再需要 `authStore` 持有 token 字符串——双 token 都在 HttpOnly cookie 里，浏览器自动管理。鉴权状态（`isAuthenticated`/`user`）由 TanStack Query 的 `useMe` hook 反映，不进 Zustand。SSR server 端的 `shared/server/auth.ts` 仅负责转发 cookie header，**不是 client store**。

```ts
// features/settings/model/theme-store.ts
/**
 * 全局主题状态
 *
 * 支持：light / dark / system
 * 持久化到 cookie，SSR 同步读取
 */
export const useThemeStore = create<ThemeState>()(persist(/* ... */))

// features/music/model/ui-store.ts
/**
 * 音乐播放器 UI 状态
 *
 * 管理：打开/关闭、迷你/全屏切换、当前可见性
 */
export const useMusicUIStore = create<MusicUIState>()
```

**Zustand 规范**：
- 一个 store 一文件（`*.store.ts`），文件头 JSDoc 说明职责
- 用 `create<State>()(persist?)` 范式
- selector 消费（`useX(s => s.foo)`）避免无谓重渲染
- 不存服务端数据快照（由 Query 管）

---

## 7. SSR 鉴权流（cookie 方案，大幅简化）

由于双 token 都入 HttpOnly cookie，鉴权流比原设计简单：

```
浏览器请求 /profile
   │
   ▼
[TanStack Start server]
   │
   ├─ 1. 从入口请求读 cookie header
   │
   ├─ 2. 创建该请求专用的 axios 实例
   │     withCredentials: true
   │     headers.Cookie = <转发浏览器 cookie>
   │     baseURL = VITE_SSR_API_BASE_URL（内网直连）
   │     关键：每请求独立实例，避免跨请求 cookie 串扰
   │
   ├─ 3. 路由 loader 用此实例预取数据
   │     context.queryClient.ensureQueryData(meKeys.me())
   │     → GET /auth/me（cookie 自动携带）→ 返回 UserDTO
   │
   ├─ 4. queryClient.dehydrate() → 序列化到 HTML
   │
   └─ 5. 渲染 <RootDocument> + 注入 dehydrated state

浏览器 hydrate
   │
   ├─ 6. QueryClient 从 dehydrated state 恢复（无额外请求）
   └─ 7. 主题从 cookie 读 mimo_theme 防闪烁
```

### 7.1 关键文件职责

```
shared/api/
├── http.ts                  createHttpClient(opts) 工厂：返回配好的 axios 实例
├── refresh-queue.ts         全局单例（client）/ 请求作用域（server）的 401 队列
├── csrf.ts                  读 mimo_csrf cookie → 注入 X-CSRF-Token header
├── error.ts                 ApiError 归一化
└── query-client.ts          createQueryClient()：新实例，SSR 每请求一个

shared/server/
├── auth.ts                  getServerAuth(): 转发请求 cookie 到 axios 实例
├── session.ts               getCurrentUser(): SSR 期间返回 UserDTO|null
├── cookies.ts               双端 cookie 读写封装
└── seo.ts                   SSR meta 注入
```

### 7.2 路由守卫

`/profile` 类需登录路由用 TanStack Router `beforeLoad`：

```ts
// routes/profile/index.tsx
export const Route = createFileRoute('/profile/')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
})
```

SSR 期间 `context.auth` 已确定（基于 cookie 是否有效），首屏即可重定向。
首期 `/profile` 只是占位页，但鉴权流要实装作为后续模板。

### 7.3 context 类型

```ts
export interface RouterContext {
  queryClient: QueryClient
  auth: {
    isAuthenticated: boolean
    user: UserDTO | null
  }
}
```

### 7.4 边缘情况

| 场景 | 处理 |
|------|------|
| SSR 期间 cookie 无效 | `auth.isAuthenticated = false`，正常渲染游客视图（不让鉴权失败导致整页 500） |
| SSR 业务接口 500 | loader 抛错 → TanStack Router `errorComponent` 渲染友好错误页 |
| hydrate 后 access cookie 过期 | axios interceptor 自动调 `/auth/refresh`，用户无感 |
| refresh 也失败 | 清 cookie（后端已处理）+ `redirect /login` + toast "登录已过期" |
| 用户登出 | `POST /auth/logout` → 后端清 cookie + blacklist → `queryClient.clear()` |

---

## 8. 工具链与配置

### 8.1 依赖清单

**dependencies**：
```jsonc
{
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "@tanstack/react-router": "^1.122.0",
  "@tanstack/react-start": "^1.122.0",
  "@tanstack/react-query": "^5.83.0",
  "@tanstack/router-devtools": "^1.122.0",
  "zustand": "^5.0.8",
  "react-hook-form": "^7.60.0",
  "zod": "^4.1.0",
  "axios": "^1.7.7",
  "axios-retry": "^4.5.0",
  "next-themes": "^0.4.4",
  "date-fns": "^4.1.0",
  "sonner": "^1.7.1",
  "lucide-react": "^0.544.0",
  "motion": "^12.23.0"
}
```

**devDependencies**：
```jsonc
{
  "vite": "^7.1.0",
  "@vitejs/plugin-react": "^4.3.4",
  "vite-tsconfig-paths": "^5.1.4",
  "tailwindcss": "^4.1.0",
  "@tailwindcss/vite": "^4.1.0",
  "@biomejs/biome": "^2.1.2",
  "typescript": "^5.9.2",
  "vitest": "^3.2.4",
  "@testing-library/react": "^16.1.0"
}
```

`@radix-ui/*`、`class-variance-authority`、`tailwind-merge`、`clsx`、`tw-animate-css` 都由 shadcn add 时按需写入。

### 8.2 工程配置文件

```
web/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts              TanStack Start 配置（含 @tailwindcss/vite）
├── app.config.ts               createStartAPI
├── biome.json                  含一文件一组件 / 导入边界等守护规则
├── components.json             shadcn/react-bits CLI
├── .npmrc / .nvmrc / .editorconfig
└── .env.example
```

### 8.3 biome.json 守护规则

```jsonc
{
  "files": { "ignore": ["src/shared/vendor/**"] },
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
        "noArrayIndexKey": "warn"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": { "maxAllowedComplexity": 15 }
      }
    }
  }
}
```

**自定义脚本守护**（放 `scripts/`，不在 web/ 内）：

| 约束 | 守护方式 |
|------|---------|
| 一文件一组件 | 脚本扫描 `src/**/*.tsx`（排除 vendor/app/routes），每文件 ≤ 1 个组件 |
| `@shared/server/*` 不进 client bundle | Biome `noRestrictedImports` |
| feature 之间禁互导 | Biome import boundary |
| 文件长度（≤150/250/400） | 脚本 `scripts/check-component-size.ts` |
| Props JSDoc | 脚本扫描导出的 `interface *Props` |
| 禁 `React.FC` | Biome `noRestrictedTypes` |

### 8.4 Tailwind v4 + 双主题

`styles/globals.css`：
```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

@theme {
  --color-border: hsl(var(--border));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ... */
}

@layer base {
  :root { --background: 0 0% 100%; /* ... */ }
  .dark { --background: 222.2 84% 4.9%; /* ... */ }
}
```

**SSR bug（TanStack router#2899）处理**：用 `@tailwindcss/vite` + Vite SSR build（v4.1+ 已修复）。fallback：全局 `<link>` 引入编译后 CSS。

### 8.5 环境变量（`.env.example`）

```bash
# 客户端：浏览器同源相对路径（由反向代理转发到后端）
VITE_API_BASE_URL=/api/v1
# 浏业端对外地址（SEO、OpenGraph）
VITE_SITE_URL=http://localhost:5173
# SSR server 端：内网直连后端，绕过反向代理
# 生产环境填 docker network 内部地址如 http://api:8080/api/v1
VITE_SSR_API_BASE_URL=http://localhost:8080/api/v1
```

---

## 9. 代码规范（强制）

### 9.1 注释规范

**禁止无意义注释**（不复述代码）。

**必须注释的内容**：
- 业务规则（状态码、枚举、阈值来源）
- 复杂逻辑（缓存策略、并发控制、refresh 队列）
- 所有 `export function`（JSDoc + `@param`/`@returns`/`@example`）
- 所有 `export function use*`（说明缓存/重试/预取策略）
- Zustand Store（说明状态用途 + 支持值）
- API 模块每个函数（标注对应接口，如 `GET /api/v1/posts/:slug`）
- React 公共组件（用途 + 支持特性）
- Feature 入口文件（文件头说明职责）

### 9.2 React 组件开发规范（强制版）

| 规则 | 要求 |
|------|------|
| **一文件一组件** | 内部组件也单独文件（第三方库组件组合除外） |
| 文件长度 | 普通 ≤150 / 复杂业务 ≤250 / 页面 ≤400，超出必须拆分 |
| 单个 return | ≤100 行 JSX |
| Props 类型 | 单独定义，**每字段必须 JSDoc** |
| 组件 JSDoc | 所有组件必须包含 |
| Hook/Utils/Types | 统一**命名导出**（禁 default） |
| 组件导出 | 统一 `const X = () => {}; export default X` |
| 禁止 | `export function` / `export default function` / 先声明后 export |
| 禁止 | `React.FC`，用直接解构 props |
| 状态管理 | useState（局部）/ Zustand（全局）/ TanStack Query（服务端）/ Router searchParams（URL），职责分明不越界 |
| useEffect | **禁止**用于请求服务端数据，必须用 useQuery/useInfiniteQuery/useMutation |
| TS Strict / SSR 兼容 / Biome 兼容 | 必须 |

违反以上任意规则视为生成失败。

---

## 10. 验收标准

首期完成时必须满足：

- [ ] `pnpm dev` 启动 SSR，首页 SSR 预取 posts/github/settings 数据
- [ ] 首页三个 react-bits 组件（Aurora/GradientText/DecryptedText）渲染正常
- [ ] 双主题切换工作，无 FOUC
- [ ] Header nav 5 项（首页/博客/关于/项目 + 音乐 action），点击音乐触发 MusicPlayer
- [ ] 占位页 `/blog` `/about` `/projects` `/profile` 显示 `<ComingSoon/>`
- [ ] `pnpm dlx biome check .` 零 error
- [ ] `pnpm tsc --noEmit` 零 error
- [ ] 鉴权链路：未登录访问受 cookie + CSRF 保护的后端 API 表现正确
- [ ] 守护脚本（一文件一组件 / Props JSDoc / 文件长度 / 导入边界）通过

---

## 11. 已知风险

| 风险 | 缓解措施 |
|------|---------|
| Tailwind v4 + TanStack Start SSR bug（#2899） | 用 `@tailwindcss/vite` + Vite SSR；fallback `<link>` |
| shadcn/react-bits CLI 与 Tailwind v4 兼容性 | slug 必须带 `-TW` 后缀；引入后立即验证 |
| cookie 跨域开发（localhost:5173 → 8080） | 后端 CORS AllowCredentials=true + origin allowlist 已配；SameSite 在跨域场景需 None+Secure |
| SSR 每请求独立 axios 实例的内存开销 | 单次请求开销极小；Node 长驻进程下 GC 自动回收 |

---

## 附录 A：后端契约（已实装）

| 后端能力 | commit | 前端对接点 |
|---------|--------|-----------|
| access/refresh HttpOnly cookie | `4a3f333` | axios `withCredentials: true` |
| CSRF double-submit（`mimo_csrf` + `X-CSRF-Token`） | `7899e79` | axios interceptor 自动注入 header |
| `GET /auth/csrf-token`（取初始 token） | `7899e79` | 未登录用户首屏前调用 |
| Auth middleware 支持 cookie 回退 | `4a3f333` | SSR 转发浏览器 cookie 即可，无需手动换 token |
| CORS AllowCredentials + 配置驱动 origin | `4a3f333` | 开发/生产 origin 在后端 config |

后端 cookie 配置项（`api/config.yaml`）：
```yaml
cookie:
  domain: ""               # 生产填主域名
  secure: false            # 生产改 true
  samesite: lax            # 跨域开发需 none+secure
  access_name: mimo_access
  refresh_name: mimo_refresh
  csrf_name: mimo_csrf
```
