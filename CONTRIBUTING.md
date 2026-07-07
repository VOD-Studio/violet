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

# 4. 启用 Git 钩子 (代码格式检查)
./scripts/install-hooks.sh
```

## 分支与提交规范

### 分支命名
- `feat/<scope>-<description>`: 新功能，如 `feat/comment-reactions`
- `fix/<scope>-<description>`: Bug 修复
- `refactor/<scope>-<description>`: 重构
- `docs/<description>`: 文档

### Commit Message 格式

commit message 无强制格式，请清晰描述本次变更的动机与内容。建议首行为简短摘要，空一行后写详细说明。

**示例**：
```
添加 OAuth 登录

集成 Google OAuth，登录后写入 user 表并签发 JWT。
```

> `pre-commit` 钩子会检查代码格式（Go gofmt、前端 biome），不影响 commit message 内容。

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
3. 提交，commit message 清晰描述变更即可（无格式强制）
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

## 发版流程

### Conventional Commits 是 CHANGELOG 的数据源

每次发版由 [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version)
从 `feat` / `fix` / `refactor` / `perf` / `docs` / `style` 类型的 commit 自动生成 CHANGELOG 条目。
因此**提交信息的质量直接决定 CHANGELOG 的可读性**：

- ✅ 一个 commit 一件事，标题清晰：`feat(admin): 接入操作日志页`
- ✅ scope 写具体模块：`api/comment`、`web/admin`，而不是笼统的 `api` / `web`
- ❌ 散文式标题：`修复编辑器的一些问题`
- ❌ 一个 commit 混多个职责：发版时无法归类

`chore` / `ci` / `build` / `test` 类型的 commit 不进入 CHANGELOG。

### 发版命令

在 `release/2.0` 分支、工作区干净、与 origin 同步时：

```bash
make release v=v2.0.1      # 显式指定版本（推荐用于里程碑版本）
make release-patch          # 从最近 tag 自动 +1（v2.0.1 → v2.0.2）
make release-minor          # 自动 +1（v2.0.1 → v2.1.0）
make release-major          # 自动 +1（v2.0.1 → v3.0.0）

# 预览不执行
make release v=v2.0.1 -- --dry-run    # 不太直观，推荐直接：
./scripts/release.sh --version v2.0.1 --dry-run
```

发版脚本会依次做：前置校验（工作区干净 / 分支正确 / 与 origin 同步 / tag 不重复 /
HEAD 上 CI 通过）→ 生成 CHANGELOG → 打 tag → 提交版本 commit → **二次确认** →
`git push --follow-tags`。

### push 即部署

push tag 会立即触发 `.github/workflows/deploy.yml`，部署到 rua 生产环境。
deploy.yml 有迁移门禁、健康检查、失败自动回滚保护。

### 回滚

```bash
make rollback v=v2.0.0      # 用 gh CLI 手动触发 deploy.yml 回滚到历史 tag（复用本地缓存镜像）
```

### 首次发版特殊处理

仓库尚无 tag 时，首次 `make release v=v2.0.0` 会用 `--first-release` 跳过 CHANGELOG
自动生成（避免把全部历史 commit 倒进一个段），CHANGELOG 的 2.0.0 条目由人工梳理。
之后的发版才走自动生成。
