<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# blog-project

## Purpose
全栈博客平台，Go 后端 (api/) + React 前端 (web/)，支持文章管理、音乐播放、评论互动、Emoji 系统、项目管理等功能。使用 Docker Compose 编排 PostgreSQL + Redis 基础设施。

## Key Files
| File | Description |
|------|-------------|
| `Makefile` | 项目管理命令入口 (dev/up/down/migrate/build) |
| `docker-compose.yml` | 本地开发 Docker 编排 (PostgreSQL 16 + Redis 7) |
| `docker-compose.prod.yml` | 生产环境 Docker 编排 |
| `dev.sh` | 一键启动开发环境脚本 |
| `.env.example` | 环境变量模板 |
| `.env` | 本地环境变量 (gitignored) |
| `.gitignore` | Git 忽略规则 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `api/` | Go 后端服务 (see `api/AGENTS.md`) |
| `web/` | React 前端应用 (see `web/AGENTS.md`) |
| `docs/` | 项目文档 (see `docs/AGENTS.md`) |
| `nginx/` | Nginx 反向代理配置 (see `nginx/AGENTS.md`) |
| `secrets/` | 生产环境密钥文件 (JWT 等，gitignored) |
| `tmp/` | 临时文件 |

## For AI Agents

### Working In This Directory
- 本地开发: `make dev` 或 `./dev.sh` 一键启动
- Docker 服务: `make up` 启动 PostgreSQL + Redis
- 数据库迁移: `make migrate` / `make reset-db`
- 前端使用 Tailwind CSS v4，支持任意数字值写法 (如 `max-w-50` = 200px)
- 前端代码检查使用 Biome (非 ESLint/Prettier)
- 后端使用 sqlc 生成数据库查询代码

### Testing Requirements
- 后端: `cd api && go test ./...`
- 前端: `cd web && npx biome check .`
- TypeScript 类型检查: `cd web && npx tsc --noEmit`

### Common Patterns
- 后端分层: handler → service → repository (严格分层)
- 前端: React + TanStack Query + Zustand/Redux 状态管理
- API 路由: chi router (Go)
- 数据库: PostgreSQL + sqlc 代码生成

## Dependencies

### External
- Go 1.25+ - 后端语言
- Node.js - 前端运行时
- Docker & Docker Compose - 容器化基础设施
- PostgreSQL 16 - 主数据库
- Redis 7 - 缓存/会话

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
