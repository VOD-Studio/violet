# mimo-blog (blog-project)

全栈博客平台 monorepo。

## 架构与代码边界
- **后端 (`api/`)**: Go 1.25, Chi 路由, PostgreSQL 16, Redis 7。
  - **关键**: 后端正在进行 DDD 架构重构，新旧架构并存。
  - 新代码使用 DDD 结构: `internal/{domain,application,infrastructure,interfaces,app}`。依赖注入使用 `wire` 管理。
  - 旧代码使用传统分层: `internal/{handler,service,repository}`（迁移中，请勿混用架构模式）。
- **前端 (`web/`)**: React 19, Vite, Tailwind CSS v4。
  - **关键**: 使用 **`pnpm`** 作为包管理器，**切勿使用 `npm` 或 `yarn`**。
  - 状态管理: Zustand + TanStack Query。

## 开发流与命令 (Makefile)
所有核心操作都通过根目录的 `Makefile` 统管：
- **启动本地开发**: `make dev` (一键启动 Postgres、Redis、API 和 Web)
- **数据库迁移**: `make migrate` (使用 golang-migrate)

### 后端 (`api/`) 须知
- **数据库代码生成**: 修改 SQL 查询后，**必须**运行 `make sqlc`。
- **依赖注入生成**: 修改 DDD 的依赖注入项后，**必须**运行 `make wire`。
- **测试**: `make api-test`
- **代码检查**: `make api-lint` (使用 golangci-lint)

### 前端 (`web/`) 须知
- **代码检查与格式化**: 使用 **Biome** (非 ESLint/Prettier)。命令: `make web-lint` 和 `make web-format`。
- **类型检查**: `make web-typecheck`
- **测试**: `make web-test`
- **Tailwind CSS v4**: 支持任意数字值简写 (例如 `max-w-50` = 200px 替代 `max-w-[200px]`)。详见 `tailwind-arbitrary-values` skill。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 提交流程规范
- 每次完成一个任务或一个功能点都要进行 Git 提交，由 AI 根据情况自行决定合适的提交粒度。
- 提交信息必须使用**中文**，并严格符合历史的 Conventional Commits 格式（例如：`feat(api): 添加新功能`，`fix(web): 修复页面 bug`）。
- **请勿推送（Do NOT push）**，仅在本地进行 commit。
