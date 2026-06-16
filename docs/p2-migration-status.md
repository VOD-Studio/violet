# P2 DDD 迁移状态与旧代码删除计划

## 当前状态（2026-06-16）

所有 9 个业务模块已**完整迁移到 DDD 四层架构**，DDD handler 通过**影子路由**
（`/api/v1/{模块}/ddd/*`）与旧路由并存运行。

### 已迁移模块
| 模块 | DDD 路由前缀 | 旧路由前缀 |
|------|-------------|-----------|
| auth | `/api/v1/auth/ddd/*` | `/api/v1/auth/*` |
| role/permission | `/api/v1/admin/ddd/roles` | `/api/v1/admin/roles` |
| post | `/api/v1/posts/ddd`, `/api/v1/admin/ddd/posts` | `/api/v1/posts`, `/api/v1/admin/posts` |
| comment | `/api/v1/posts/ddd/{id}/comments`, `/api/v1/admin/ddd/comments` | `/api/v1/posts/{id}/comments`, `/api/v1/admin/comments` |
| announcement | `/api/v1/announcements/ddd`, `/api/v1/admin/ddd/announcements` | `/api/v1/announcements`, `/api/v1/admin/announcements` |
| project | `/api/v1/projects/ddd`, `/api/v1/admin/ddd/projects` | `/api/v1/projects`, `/api/v1/admin/projects` |
| emoji/music/upload | `/api/v1/*/ddd/*`, `/api/v1/admin/ddd/*` | `/api/v1/emojis`, `/api/v1/music`, `/api/v1/admin/*` |

## 旧代码删除计划（推迟执行）

### 为什么不立即删除
1. 旧代码（sqlc generated → service → handler → main.go 路由）是一个**整体依赖链**
2. main.go 中旧路由与 DDD 路由**路径冲突**（都用 `/api/v1/posts`），chi 不允许同路径重复注册
3. 删除需要：重写 main.go ~400 行 + 删除 ~25 个旧 service + ~17 个旧 handler + sqlc generated 目录
4. 这是破坏性操作，应**先验证 DDD 路由全部工作正常**，再在独立 PR 删除

### 删除步骤（独立 PR）
1. **前端切换**：把前端 API 调用从旧路径切到 DDD 路径（去掉 `/ddd/`）
2. **验证**：启动服务 + 前端，手动测试所有功能
3. **main.go 重写**：
   - 删除 `queries := generated.New(db)` 及所有旧 service/handler 初始化
   - 删除旧路由注册（`/api/v1/auth/*`、`/api/v1/posts` 等）
   - DDD 路由去掉 `/ddd/` 前缀，转正为正式路径
   - 删除 `initSuperAdmin`（迁移到 DDD auth 模块的 seed 逻辑）
4. **删除旧代码**：
   - `internal/handler/` 全部
   - `internal/service/` 全部（保留 email_service.go 供 DDD 复用，或迁移到 infrastructure）
   - `internal/repository/generated/` 全部
   - `internal/repository/queries/` 全部
   - `sqlc.yaml`
   - `internal/pkg/apierr/`（已被 domain/shared/error.go 取代）
5. **go.mod 清理**：移除 `sqlc-dev/pqtype`、`lib/pq` 等仅 sqlc 使用的依赖

### 保留的旧代码（不删除）
- `internal/middleware/` — DDD 仍复用旧 Auth/AdminRequired/RateLimit 中间件
- `internal/model/` — UploadSession 等 GORM model 仍被 DDD session_repo 引用
- `internal/pkg/response/` — 部分 DDD handler 可能复用
- `internal/pkg/auth/context.go` — context key 定义
- `internal/job/` — 后台清理任务
- `internal/migrate/` — golang-migrate 封装（仍用于旧 schema 迁移）

## schema 管理说明

采用**全 GORM AutoMigrate** 策略（P2 决策）：
- `main.go` 中 `gormDB.AutoMigrate(&newmodel.User{}, ...)` 管理所有 DDD model 的 schema
- 旧 migration 文件（`migrations/*.sql`）保留作为历史记录，但新 schema 变更通过 model struct
- 注意：AutoMigrate 只增不减（不删除列/表），schema 收缩需手动 SQL
