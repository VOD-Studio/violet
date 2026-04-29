# Creative Developer Blog - Architecture Analysis

## Project Overview

一个有创意元素的开发者个人博客网站，前后端分离架构。
包含**前台展示**和**后台管理系统**，支持用户注册（邮箱验证码）、登录、评论等功能。

---

## Tech Stack

### Frontend — 前台 (Blog)

| Technology | Version | Purpose |
|---|---|---|
| React | ^19 | UI framework (use() hook, React Compiler) |
| Vite | ^6 | Build tool & dev server |
| TypeScript | ^5.7 | Type safety |
| Tailwind CSS | ^4 | Styling (CSS-native @theme, no config file) |
| Motion | latest | Scroll animations, page transitions, hover effects |
| Biome | latest | Lint + format (replaces ESLint + Prettier) |
| Velite | latest | Type-safe MDX content pipeline |
| Shiki | latest | Syntax highlighting (VS Code themes) |
| React Router | ^7 | Client-side routing with middleware support |
| @unpic/react | latest | Responsive image optimization |
| react-markdown | latest | Markdown rendering for comments |

### Frontend — 后台 (Admin Dashboard)

| Technology | Version | Purpose |
|---|---|---|
| shadcn/ui | latest | UI components (Sidebar, DataTable, Form, Dialog) |
| TanStack Table | latest | Headless data tables |
| React Hook Form | latest | Form handling |
| Zod | latest | Schema validation |
| Tiptap v3 | latest | Rich text / Markdown editor |
| Recharts | latest | Dashboard analytics charts |
| UploadThing / react-dropzone | latest | Image upload |
| jose | latest | Client-side JWT verification |

### Backend (Go)

| Technology | Version | Purpose |
|---|---|---|
| Go | 1.25+ | Language runtime |
| chi | v5 | HTTP router (net/http compatible) |
| sqlc + pgx | latest | Type-safe SQL → Go codegen |
| golang-migrate | latest | Database schema migrations |
| golang-jwt | v5 | JWT authentication |
| goldmark | latest | Markdown → HTML rendering |
| validator | latest | Request validation |
| resend-go | latest | Email sending (verification codes) |
| PostgreSQL | 16+ | Primary database |
| Redis | 7+ | Verification codes, session cache, rate limiting |
| S3/R2 | - | Image & asset storage |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │    Blog (前台)           │  │    Admin Dashboard (后台)    │  │
│  │                         │  │                             │  │
│  │  ┌───────┐ ┌─────────┐  │  │  ┌───────┐ ┌─────────────┐  │  │
│  │  │ Home  │ │PostList │  │  │  │Posts  │ │Comments     │  │  │
│  │  │       │ │         │  │  │  │Editor │ │Moderation   │  │  │
│  │  └───────┘ └─────────┘  │  │  └───────┘ └─────────────┘  │  │
│  │  ┌───────┐ ┌─────────┐  │  │  ┌───────┐ ┌─────────────┐  │  │
│  │  │Post   │ │Projects │  │  │  │Media  │ │Users        │  │  │
│  │  │Detail │ │Showcase │  │  │  │Library│ │Management   │  │  │
│  │  └───────┘ └─────────┘  │  │  └───────┘ └─────────────┘  │  │
│  │  ┌───────┐ ┌─────────┐  │  │  ┌───────┐ ┌─────────────┐  │  │
│  │  │About  │ │Login    │  │  │  │Dash-  │ │SEO          │  │  │
│  │  │       │ │Register │  │  │  │board  │ │Settings     │  │  │
│  │  └───────┘ └─────────┘  │  │  └───────┘ └─────────────┘  │  │
│  │                         │  │                             │  │
│  │  Motion + Creative      │  │  shadcn/ui + TanStack       │  │
│  │  Animations             │  │  Table + Tiptap             │  │
│  └────────────┬────────────┘  └──────────────┬──────────────┘  │
│               │                              │                 │
│  ┌────────────┴──────────────────────────────┴──────────────┐  │
│  │              Shared API Client (fetch + JWT)              │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ REST API (JSON)
┌──────────────────────────────┼──────────────────────────────────┐
│                        Backend (Go + chi)                        │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │              Middleware Layer                               │  │
│  │  (CORS, JWT Auth, Logging, Rate Limit, CSRF, Role Check)  │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │              HTTP Handlers                                 │  │
│  │  /api/auth    /api/posts    /api/comments                  │  │
│  │  /api/users   /api/images   /api/tags                      │  │
│  │  /api/admin/* (admin-only endpoints)                       │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │              Service Layer                                 │  │
│  │  AuthService (login/register/verify/reset)                 │  │
│  │  PostService (CRUD/search/publish)                         │  │
│  │  CommentService (create/moderate/thread)                   │  │
│  │  EmailService (send verification/reset codes)              │  │
│  │  ImageService (upload/presign/optimize)                    │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │              Repository Layer (sqlc generated)             │  │
│  └──────┬──────────────┬──────────────┬──────────────┬────────┘  │
│         │              │              │              │           │
│    ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐      │
│    │PostgreSQL│   │ Redis   │   │ S3/R2   │   │ Resend  │      │
│    │ (data)  │   │ (cache) │   │(assets) │   │ (email) │      │
│    └─────────┘   └─────────┘   └─────────┘   └─────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

### Frontend (`/web`)

```
web/
├── public/
│   └── images/
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── layout/              # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── BentoGrid.tsx
│   │   │   └── AdminLayout.tsx  # Admin sidebar + topbar
│   │   ├── blog/                # Blog-specific components
│   │   │   ├── PostCard.tsx
│   │   │   ├── PostList.tsx
│   │   │   ├── CodeBlock.tsx
│   │   │   ├── TableOfContents.tsx
│   │   │   └── CommentSection.tsx
│   │   ├── auth/                # Auth components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   ├── VerifyEmailForm.tsx
│   │   │   └── ForgotPasswordForm.tsx
│   │   ├── admin/               # Admin-specific components
│   │   │   ├── PostEditor.tsx       # Tiptap editor
│   │   │   ├── PostTable.tsx        # TanStack Table
│   │   │   ├── CommentModeration.tsx
│   │   │   ├── MediaLibrary.tsx
│   │   │   ├── DashboardStats.tsx   # Recharts
│   │   │   └── UserManagement.tsx
│   │   ├── creative/            # Creative/experimental elements
│   │   │   ├── ParticleBackground.tsx
│   │   │   ├── ScrollReveal.tsx
│   │   │   ├── KineticText.tsx
│   │   │   └── CursorEffect.tsx
│   │   └── shared/              # Shared components
│   │       ├── SEO.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── CommentForm.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── BlogList.tsx
│   │   ├── BlogPost.tsx
│   │   ├── Projects.tsx
│   │   ├── About.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── VerifyEmail.tsx
│   ├── admin/                   # Admin pages
│   │   ├── Dashboard.tsx
│   │   ├── Posts.tsx            # Post list + CRUD
│   │   ├── PostEdit.tsx         # Create/edit post
│   │   ├── Comments.tsx         # Comment moderation
│   │   ├── Media.tsx            # Media library
│   │   ├── Users.tsx            # User management
│   │   └── Settings.tsx         # Site settings
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePosts.ts
│   │   ├── useComments.ts
│   │   ├── useScrollProgress.ts
│   │   └── useReducedMotion.ts
│   ├── lib/
│   │   ├── api.ts               # API client with JWT
│   │   ├── auth.ts              # Auth utilities
│   │   ├── mdx.ts               # MDX processing
│   │   ├── animations.ts        # Shared animation configs
│   │   └── validations.ts       # Zod schemas
│   ├── middleware/
│   │   └── auth.ts              # Route protection middleware
│   ├── styles/
│   │   └── index.css            # Tailwind v4 @theme config
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── content/                      # MDX blog posts
│   ├── posts/
│   └── projects/
├── biome.json
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Backend (`/api`)

```
api/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── handler/
│   │   ├── auth.go              # Login, register, verify, reset
│   │   ├── post.go              # CRUD posts
│   │   ├── comment.go           # Comment CRUD + moderation
│   │   ├── user.go              # User management
│   │   ├── image.go             # Image upload
│   │   ├── tag.go               # Tag management
│   │   └── admin.go             # Admin-only endpoints
│   ├── service/
│   │   ├── auth_service.go      # Auth logic + JWT
│   │   ├── post_service.go      # Post business logic
│   │   ├── comment_service.go   # Comment logic + anti-spam
│   │   ├── email_service.go     # Email verification codes
│   │   └── image_service.go     # Image processing
│   ├── repository/
│   │   ├── queries/             # SQL queries (sqlc input)
│   │   │   ├── users.sql
│   │   │   ├── posts.sql
│   │   │   ├── comments.sql
│   │   │   └── tags.sql
│   │   └── generated/           # sqlc generated Go code
│   ├── model/
│   │   └── types.go
│   └── middleware/
│       ├── auth.go              # JWT verification
│       ├── admin.go             # Admin role check
│       ├── cors.go
│       ├── logger.go
│       └── ratelimit.go
├── config/
│   └── config.go
├── migrations/
│   ├── 001_create_users.up.sql
│   ├── 002_create_posts.up.sql
│   ├── 003_create_comments.up.sql
│   ├── 004_create_tags.up.sql
│   └── ...
├── api/
│   └── openapi.yaml
├── sqlc.yaml
├── go.mod
└── go.sum
```

---

## Database Schema (PostgreSQL)

```sql
-- Users table (支持邮箱验证)
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    bio             TEXT,
    role            VARCHAR(20) DEFAULT 'user',  -- user, author, admin
    email_verified  BOOLEAN DEFAULT false,
    is_active       BOOLEAN DEFAULT false,        -- 激活需邮箱验证
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table (支持 Markdown 内容)
CREATE TABLE posts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(255) NOT NULL,
    slug          VARCHAR(255) UNIQUE NOT NULL,
    content_md    TEXT NOT NULL,                   -- Markdown 原文
    content_html  TEXT NOT NULL,                   -- 渲染后的 HTML
    excerpt       TEXT,
    cover_image   TEXT,
    status        VARCHAR(20) DEFAULT 'draft',    -- draft, published, archived
    author_id     UUID REFERENCES users(id),
    view_count    INTEGER DEFAULT 0,
    is_featured   BOOLEAN DEFAULT false,
    seo_title     VARCHAR(255),
    seo_description TEXT,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tags table
CREATE TABLE tags (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(50) UNIQUE NOT NULL,
    slug  VARCHAR(50) UNIQUE NOT NULL
);

-- Post-Tags junction
CREATE TABLE post_tags (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    tag_id  INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- Comments table (支持嵌套回复)
CREATE TABLE comments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
    parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
    path          TEXT NOT NULL,                   -- materialized path: '/uuid1/uuid2'
    depth         SMALLINT NOT NULL DEFAULT 0 CHECK (depth <= 4),
    author_name   VARCHAR(100) NOT NULL,
    author_email  VARCHAR(255),
    author_url    TEXT,
    avatar_url    VARCHAR(512),                   -- Gravatar
    body_md       TEXT NOT NULL,                   -- Markdown 原文
    body_html     TEXT NOT NULL,                   -- 渲染后的 HTML
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','spam','deleted')),
    ip_hash       VARCHAR(64),
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON comments(post_id, created_at) WHERE status = 'approved';
CREATE INDEX idx_comments_path ON comments(path);

-- Projects table (开发者作品集)
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    tech_stack  TEXT[],
    repo_url    TEXT,
    demo_url    TEXT,
    image_url   TEXT,
    featured    BOOLEAN DEFAULT false,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Site settings (key-value)
CREATE TABLE site_settings (
    key   VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

### Auth (认证)
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | 注册（发送验证码） | No |
| POST | `/api/auth/verify-email` | 验证邮箱验证码 | No |
| POST | `/api/auth/login` | 登录，返回 JWT | No |
| POST | `/api/auth/refresh` | 刷新 access token | Refresh |
| POST | `/api/auth/logout` | 登出，清除 refresh token | Yes |
| POST | `/api/auth/forgot-password` | 发送密码重置码 | No |
| POST | `/api/auth/reset-password` | 验证重置码 + 新密码 | No |
| GET  | `/api/auth/me` | 获取当前用户信息 | Yes |

### Posts (文章)
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/posts` | 文章列表（分页、筛选） | No |
| GET | `/api/posts/:slug` | 按 slug 获取文章 | No |
| POST | `/api/posts` | 创建文章 | Admin |
| PUT | `/api/posts/:id` | 更新文章 | Admin |
| DELETE | `/api/posts/:id` | 删除文章 | Admin |
| POST | `/api/posts/:id/view` | 增加浏览量 | No |
| PATCH | `/api/posts/:id/status` | 发布/归档文章 | Admin |

### Tags (标签)
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/tags` | 所有标签 | No |
| GET | `/api/tags/:slug/posts` | 按标签查文章 | No |
| POST | `/api/tags` | 创建标签 | Admin |
| DELETE | `/api/tags/:id` | 删除标签 | Admin |

### Comments (评论)
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/posts/:id/comments` | 文章评论列表（分页） | No |
| POST | `/api/posts/:id/comments` | 提交评论（含蜜罐检测） | No |
| PATCH | `/api/comments/:id/status` | 审核评论（批准/垃圾/删除） | Admin |
| GET | `/api/admin/comments/pending` | 待审核评论队列 | Admin |
| DELETE | `/api/comments/:id` | 删除评论 | Admin |

### Users (用户管理)
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/users` | 用户列表 | Admin |
| PATCH | `/api/admin/users/:id/role` | 修改用户角色 | Admin |
| PATCH | `/api/admin/users/:id/status` | 启用/禁用用户 | Admin |

### Images (图片)
| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/images/upload` | 获取预签名上传 URL | Yes |
| GET | `/api/images/:key` | CDN 重定向获取图片 | No |

### Admin (后台统计)
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/admin/stats` | 总览统计（文章数、评论数、浏览量） | Admin |
| GET | `/api/admin/stats/views` | 浏览量趋势数据 | Admin |

---

## Auth Flow (认证流程)

### 注册 + 邮箱验证

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │                    │  Redis   │
└────┬─────┘                    └────┬─────┘                    └────┬─────┘
     │                               │                               │
     │  POST /auth/register          │                               │
     │  {email, password, username}  │                               │
     ├──────────────────────────────>│                               │
     │                               │  Generate 6-digit code        │
     │                               │  (crypto/rand)                │
     │                               │                               │
     │                               │  Store SHA256(code)           │
     │                               ├──────────────────────────────>│
     │                               │  verify:{email} TTL=10min     │
     │                               │                               │
     │                               │  Send email via Resend        │
     │                               │  (rate: 5/hour per email)     │
     │                               │                               │
     │  {message: "验证码已发送"}      │                               │
     │<──────────────────────────────│                               │
     │                               │                               │
     │  POST /auth/verify-email      │                               │
     │  {email, code}                │                               │
     ├──────────────────────────────>│                               │
     │                               │  Check Redis                  │
     │                               ├──────────────────────────────>│
     │                               │  Compare SHA256(code)         │
     │                               │  Max 5 attempts               │
     │                               │                               │
     │                               │  Delete key on success        │
     │                               ├──────────────────────────────>│
     │                               │                               │
     │                               │  Set user.is_active = true    │
     │                               │  Set user.email_verified = true
     │                               │                               │
     │  {message: "验证成功"}          │                               │
     │<──────────────────────────────│                               │
     │                               │                               │
```

### 登录

```
POST /auth/login {email, password}
  → Verify password (bcrypt)
  → Check user.is_active (必须已验证邮箱)
  → Generate access token (JWT, 15min, ES256)
  → Generate refresh token (JWT, 7 days, HttpOnly cookie)
  → Return {access_token, user}
```

### 密码重置

```
POST /auth/forgot-password {email}
  → Generate code (same as verification)
  → Store in Redis: reset:{email} TTL=10min
  → Send email

POST /auth/reset-password {email, code, new_password}
  → Verify code against Redis
  → Update password_hash
  → Delete Redis key
```

---

## Comment System (评论系统)

### Anti-Spam Stack (反垃圾策略)

```
1. Honeypot Field  → 隐藏表单字段，机器人会自动填充，静默拒绝
2. Rate Limit      → 3 条评论/分钟 per IP (Redis sliding window)
3. Slow Mode       → JS 端要求提交前至少等待 5 秒
4. Content Filter  → 正则检测链接密度 + 敏感词
5. Moderation Queue→ 新评论默认 pending，管理员审核后 approved
```

### Comment Threading (评论嵌套)

```
Post
├── Comment A (depth=0, path='/a-uuid')
│   ├── Reply A1 (depth=1, path='/a-uuid/a1-uuid')
│   │   └── Reply A1a (depth=2, path='/a-uuid/a1-uuid/a1a-uuid')
│   └── Reply A2 (depth=1, path='/a-uuid/a2-uuid')
└── Comment B (depth=0, path='/b-uuid')

最大嵌套深度: 4 层
查询: SELECT * FROM comments WHERE post_id = ? AND status = 'approved' ORDER BY path
```

---

## Admin Dashboard (后台管理)

### Admin 路由结构

```
/admin                    → Dashboard (统计概览)
/admin/posts              → 文章列表 (TanStack Table)
/admin/posts/new          → 新建文章 (Tiptap 编辑器)
/admin/posts/:id/edit     → 编辑文章
/admin/comments           → 评论审核队列
/admin/media              → 媒体库 (图片管理)
/admin/users              → 用户管理
/admin/settings           → 站点设置
```

### Admin Layout

```
┌──────────────────────────────────────────────────────┐
│  Topbar: Search │ Notifications │ User Avatar ▼      │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │              Content Area                 │
│          │                                           │
│ Dashboard│  ┌─────────────────────────────────────┐  │
│ Posts    │  │  Breadcrumb: Admin > Posts           │  │
│ Comments │  ├─────────────────────────────────────┤  │
│ Media    │  │                                     │  │
│ Users    │  │     Page Content (DataTable /        │  │
│ Settings │  │     Form / Editor / Charts)          │  │
│          │  │                                     │  │
│          │  └─────────────────────────────────────┘  │
│          │                                           │
└──────────┴───────────────────────────────────────────┘

使用 shadcn/ui sidebar-07 block (可折叠侧边栏)
```

### Admin 功能清单

| 功能 | 组件 | 说明 |
|---|---|---|
| 文章管理 | DataTable + Tiptap | CRUD、发布/草稿切换、批量操作 |
| 评论审核 | DataTable + Dialog | 批准/标记垃圾/删除、快速预览 |
| 媒体库 | Grid + Dropzone | 图片上传、拖拽排序、裁剪 |
| 用户管理 | DataTable + Form | 角色分配、启用/禁用 |
| 数据看板 | Recharts Cards | 浏览量趋势、热门文章、评论统计 |
| SEO 设置 | Form per post | 自定义 title、description、OG image |

---

## Creative Features Plan (前台创意特性)

### Phase 1: Foundation (Week 1-2)
- [ ] 项目脚手架 (Vite + Go + shadcn)
- [ ] 数据库 schema + migrations
- [x] 认证系统 (注册/验证/登录/JWT)
- [ ] 基础 API (CRUD)
- [x] 前台路由 + 布局
- [ ] 后台路由 + Admin 布局
- [ ] Tailwind v4 主题配置

### Phase 2: Core Blog (Week 3-4)
- [ ] MDX 内容管道 (Velite)
- [ ] 文章渲染 + Shiki 代码高亮
- [ ] 标签系统 + 筛选
- [ ] 搜索功能
- [ ] Bento Grid 响应式布局
- [ ] 后台文章编辑器 (Tiptap)

### Phase 3: Comments & Users (Week 5-6)
- [ ] 评论系统 (嵌套回复 + Markdown)
- [ ] 评论审核队列 (后台)
- [ ] 反垃圾策略 (蜜罐 + 限流)
- [ ] 用户管理 (后台)
- [ ] 邮箱验证流程
- [ ] 密码重置流程

### Phase 4: Creative Elements (Week 7-8)
- [ ] Scroll-driven 动画 (Motion)
- [ ] 页面过渡 (View Transitions API)
- [ ] 动态排版 (Kinetic Typography)
- [ ] 粒子背景 (Canvas, respects reduced-motion)
- [ ] 光标跟随效果
- [ ] 磁性按钮交互

### Phase 5: Developer Features (Week 9-10)
- [ ] GitHub 集成 (贡献图、pinned repos)
- [ ] 交互式代码沙盒 (Sandpack)
- [ ] 项目展示 + 技术栈可视化
- [ ] 暗色/亮色主题切换

### Phase 6: Polish (Week 11-12)
- [ ] 后台数据看板 (Recharts)
- [ ] SEO 优化 (meta, OG, structured data)
- [ ] 性能审计 (Core Web Vitals)
- [ ] 无障碍审计
- [ ] RSS feed
- [ ] Sitemap 生成
- [ ] 分析集成

---

## Key Design Decisions

### 前台 vs 后台分离
- **前台** (Blog): 面向访客，注重创意动画和阅读体验
- **后台** (Admin): 面向站长，注重效率和功能完整性
- 共享 API Client 和 Auth 模块，但 UI 和交互完全不同

### 为什么用 shadcn/ui 做后台？
- 博客后台不需要 Ant Design 这种重型组件库
- shadcn 提供 ~15 个足够用的组件 (Table, Form, Dialog, Sidebar)
- 完全 Tailwind 原生，零额外 bundle 开销
- 自带 Dashboard Block 可直接使用

### 为什么用 Tiptap 做编辑器？
- Headless = 完全 Tailwind 控制样式
- StarterKit 原生支持 Markdown 快捷键
- 可扩展: 代码高亮、图片上传、斜杠命令
- Plate (Slate) API 更复杂，Milkdown 社区更小

### 为什么自建评论而不只用 Giscus？
- Giscus 需要 GitHub 账号，限制了普通访客
- 自建评论支持匿名评论、完全数据所有权
- 评论审核队列是后台管理的重要功能
- 但可以同时支持 Giscus 作为可选方案

### 为什么 Resend 而不是 net/smtp？
- 高送达率，避免被标记为垃圾邮件
- 简单的 API，不需要处理 TLS 连接
- 支持 HTML 模板
- 有免费额度适合个人博客

### 为什么 REST over GraphQL？
- 博客是 CRUD 应用，REST 更简单
- 前端数据需求固定
- 减少后端复杂度

---

## Redis Key Structure

| Key Pattern | TTL | Purpose |
|---|---|---|
| `verify:{email}` | 10 min | 邮箱验证码 (SHA256 hash) |
| `reset:{email}` | 10 min | 密码重置码 |
| `rate:send:{ip}` | 1 hour | 发送限流 per IP (50/hour) |
| `rate:send:{email}` | 1 hour | 发送限流 per email (5/hour) |
| `rate:attempt:{email}` | 10 min | 验证尝试次数 (max 5) |
| `rate:comment:{ip}` | 1 min | 评论限流 (3/min) |
| `refresh:{user_id}` | 7 days | Refresh token 存储 |
| `session:{token_hash}` | 15 min | Session cache |

---

## Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| LCP | < 2.5s | 图片懒加载、CDN、代码分割 |
| INP | < 200ms | 延迟加载非关键 JS |
| CLS | < 0.1 | 为动画元素预留空间 |
| Bundle Size | < 200KB (gzipped) | Tree shaking、动态导入 |
| API Response | < 100ms (p95) | Redis 缓存、sqlc 编译时优化 |

## Accessibility

- 所有动画遵守 `prefers-reduced-motion`
- 语义化 HTML 结构
- 键盘导航支持
- 色彩对比度 WCAG AA 标准
- 屏幕阅读器兼容

---

## Deployment Strategy

| Component | Platform | Reason |
|---|---|---|
| Frontend (Blog) | Cloudflare Pages | 全球 CDN、自动部署 |
| Frontend (Admin) | 同一 Vite 构建，路由分离 | 简化部署，共享代码 |
| Backend API | Railway / Fly.io | Go 容器化部署 |
| Database | Neon / Supabase | 托管 PostgreSQL |
| Image Storage | Cloudflare R2 | S3 兼容、无出口费 |
| Cache | Upstash Redis | Serverless Redis |
| Email | Resend | 高送达率、免费额度 |
