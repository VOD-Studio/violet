# 贡献指南

感谢你对 mimo-blog 项目的关注！本文档描述参与开发的流程与规范。

## 开发环境搭建

```bash
# 1. Fork 并 clone 仓库
git clone <your-fork-url>
cd mimo-blog

# 2. 安装依赖
make install          # 后端 go mod download + 前端 pnpm install

# 3. 初始化环境
make env          # 复制 .env.example 到 .env，修改敏感配置
make setup        # 生成 JWT 密钥 + 启动数据库 + 迁移

# 4. 启用 Git 钩子 (强制提交规范)
./scripts/install-hooks.sh
```

## 分支与提交规范

### 分支命名
- `feat/<scope>-<description>`: 新功能，如 `feat/comment-reactions`
- `fix/<scope>-<description>`: Bug 修复
- `refactor/<scope>-<description>`: 重构
- `docs/<description>`: 文档

### Commit Message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body 可选>

<footer 可选>
```

**type**（必填）：
| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（非 feat 非 fix） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建系统或依赖变更 |
| `ci` | CI 配置 |
| `chore` | 杂项（不修改 src 或 test） |
| `revert` | 回滚 commit |

**scope**（可选）：影响范围，如 `auth`、`web`、`api`、`infra`、`db`

**示例**：
```
feat(auth): 添加 OAuth 登录
fix(comment): 修复分页越界导致 500
docs(api): 更新 OpenAPI 说明
refactor(post): 文章模块迁移到 DDD
chore(infra): 升级 PostgreSQL 16
```

> 提交时 `commit-msg` 钩子会自动校验格式，不符合则拒绝。

## 代码规范

### 后端 (Go)
- 格式化：`gofmt -w .`（pre-commit 强制）
- 检查：`go vet ./...`（`make api-lint`）
- 测试：`go test ./...`
- 架构：遵循 DDD 分层（P1 重构进行中，新代码走 `domain/application/infrastructure/interfaces`）
- 注释：导出函数/类型必须有中文 doc comment

### 前端 (TypeScript)
- 格式化 + 检查：`npx @biomejs/biome check --write .`（`make web-lint`）
- 类型检查：`npx tsc --noEmit`（strict 模式已启用）
- 构建：`npm run build`
- 架构：feature-sliced（每个业务模块自带 `api.ts` + `queryKeys.ts` + `types.ts`）

### 通用
- 缩进：Go 用 tab，TS/JS/YAML 用 2 空格（详见 `.editorconfig`）
- 换行符：LF
- 文件末尾保留空行

## 提交 PR 流程

1. 从 `main` 创建特性分支
2. 开发并确保本地检查通过：
   ```bash
   make api-lint && make web-lint && make web-typecheck
   go test ./...
   ```
3. 提交时遵守 Conventional Commits 格式
4. 推送并创建 PR，描述：
   - 变更内容与动机
   - 是否有破坏性变更
   - 测试情况
5. 等待 CI 通过 + Code Review

## 测试要求

- 新功能必须附带单元测试
- Bug 修复应包含回归测试
- 后端测试在 `api/go test ./...`
- 前端测试（P2 引入 Vitest）

## 目录约定

新增功能时参考现有目录结构。**特别提醒**：

- 后端新代码应放在 DDD 四层结构下（`internal/domain/<module>/`、`internal/application/<module>/` 等）
- 旧分层 `internal/{handler,service,repository}` 正在逐步废弃，不要在其中新增模块
- 前端业务模块放在 `src/features/<module>/`，跨功能复用组件放 `src/components/`

## 问题与反馈

- 发现 Bug：创建 Issue，附复现步骤与日志
- 新功能建议：创建 Issue 描述使用场景
- 安全漏洞：请勿公开 Issue，私信维护者
