# 贡献指南

感谢你对 violet 项目的关注！本文档描述参与开发的流程与规范。开发主分支为 **`release/2.0`**。

## 开发环境搭建

```bash
# 1. Fork 并 clone 仓库
git clone <your-fork-url>
cd violet

# 2. 安装依赖
make install          # 后端 go mod download + 前端 pnpm install

# 3. 初始化环境（复制根 .env 模板；api/config.yaml 已入库无需复制）
make env

# 4. 启动数据库 + 迁移
make setup

# 5. 启用 Git 钩子（提交前格式检查）
./scripts/install-hooks.sh
```

## 分支规范

每个新任务 / feature 先从 `release/2.0` 新建分支完成，不在 `release/2.0` 上直接开发。

格式：**`<type>/<scope>-<简述>`**

- **type** 对齐 Conventional Commits：`feat` / `fix` / `chore` / `docs` / `refactor` / `style` / `test` / `perf` / `hotfix`
- **scope** 指向最内层模块：前端（`posts`/`editor`/`auth`/`comments`）、后端（`handler`/`service`/`domain`/`repository`）、或文件 / 区域名（`readme`/`ci`/`deps`）
- 全小写，`/` 分段，`-` 连词；无空格、无大写、无特殊字符

✅ 正确：`feat/post-slug-pinyin`、`fix/handler-search-encoding`、`chore/deps-bump`
❌ 错误：`update`、`Fix/Login`、`new-feature`

## 提交规范（Conventional Commits）

提交信息使用**中文**，严格遵循 Conventional Commits 格式，如 `feat(api): 添加新功能`：

- **subject 只概括一个主要变更**：祈使句、简洁（50 字符内为宜）、禁止用 `+`/`、` 堆砌多要点
- **scope 指向最小改动单元**：`fix(handler): 搜索接口 URL 编码修复` ✅，`fix(api/handler): ...` ❌（api 是冗余前缀）
- **body 用 bullet points 列出改动事实**，不写散文；决策过程写在 PR 描述或 ADR
- **前后端必须分离提交**：同时改到 `api/` 和 `web/` 时拆成多个 commit
- **公共组件倾向单独提交**：`web/src/shared/ui` 下被多个 feature 引用的改动，能独立 revert 时单独提交

## 代码规范

### 后端 (Go)

- 检查 / 测试：`make api-lint`（golangci-lint）、`make api-test`
- **架构**：新代码走 DDD 四层 `internal/{domain,application,infrastructure,interfaces}`；旧分层 `internal/{handler,service,repository}` 迁移中，**不要在其中新增模块**。领域逻辑进 domain，用例编排进 application，基础设施细节进 infrastructure
- **注释**：只写代码无法自表达的信息（非显然陷阱、业务规则、魔法值理由）；领域实体/值对象的每个命名字段补中文注释；不要复读签名、不要写设计论证

### 前端 (TypeScript)

- 包管理器：**pnpm**，禁止 npm / yarn
- 检查 / 测试：`make web-lint`（Biome）、`make web-typecheck`（tsc）、`make web-test`（Vitest）；`make web-format` 自动修复
- **架构**：Feature-Sliced Design（`shared` → `entities` → `features` → `widgets`）。业务逻辑不进 `shared/`；跨 feature 复用件先提到 `shared/` 落定归属再接新 feature
- 依赖方向：`shared` 不反向依赖 `features`

### 通用

- 缩进：tab（Go 与前端统一 tab 4，见 `.editorconfig`）；YAML 与根级 JSON 用 2 空格
- 换行符：LF，文件末尾保留空行
- 配置/文档改动若涉及配置架构，遵循 Grafana 模式：`api/config.yaml` 入库为权威文档，敏感值一律走根 `.env`

## 提交 PR 流程

1. 从 `release/2.0` 创建特性分支（见上）
2. 开发并确保本地检查通过：
   ```bash
   make api-lint && make web-lint && make web-typecheck
   make api-test && make web-test
   ```
3. 原子提交（见提交规范），推送分支
4. 创建 PR，固定配齐：
   - **base**：`release/2.0`（不是 `main`）
   - **assignees**：`@me`
   - **reviewers**：仓库全部 collaborator（`DefectingCat`、`xunrua`、`JingpengZhang`）
   - **labels**：默认不加；仅当性质明确匹配内置语义时才加（纯文档 `documentation`、修 bug `bug`）
   - 描述：变更内容与动机、破坏性变更、测试情况
5. 等待 CI 通过 + Code Review；合并使用 **merge commit**（保留原子 commit 粒度），合并后自动删除分支

## 发版流程（release-please 自动化）

violet 的发版由 **release-please** 全自动驱动，本地不需要任何发版命令：

```
push 发版型 commit 到 release/2.0
  → CI 通过
  → release-please 自动开 release PR（含 CHANGELOG 更新与版本号推导）
  → 维护者 review 合并 release PR
  → 自动打 tag → deploy.yml 自动部署到 xunrua.top
```

- **发版型 commit**：`feat` / `fix` / `perf` / `refactor` 等，才会触发新版本
- **不发版**：`docs` / `chore` / `ci` / `build` / `test` 类型不触发（changelog-sections 配置为 hidden，全部 hidden 时跳过开 PR）
- **提交信息质量直接决定 CHANGELOG 可读性**：一个 commit 一件事、scope 写具体模块
- 部署链路有迁移门禁、健康检查、失败自动回滚保护；细节见 [发布手册](docs/deploy/release-runbook.md)
- release-please 故障需应急时：`git tag vX.Y.Z && git push origin vX.Y.Z` 直接触发部署

## 测试要求

- 新功能必须附带单元测试；Bug 修复应包含回归测试
- 后端：`make api-test`（domain 层聚合根不变量 + application 层用例编排）
- 前端：`make web-test`（Vitest + React Testing Library）
- 后端 DDL 类改动（uuid/jsonb 等强类型列）建议跑真实 PostgreSQL 端到端验证

## 目录约定

新增功能时参考现有目录结构。**特别提醒**：

- 后端新代码放在 DDD 四层结构下（`internal/domain/<module>/`、`internal/application/<module>/` 等）
- 前端业务模块放在 `src/features/<module>/`，跨功能复用组件放 `src/shared/ui/`
- 公共件是否归 `shared/` 看「是否被多个 feature 引用」，而非位置

## 问题与反馈

- 发现 Bug：创建 Issue，附复现步骤与日志
- 新功能建议：创建 Issue 描述使用场景
- 安全漏洞：请勿公开 Issue，私信维护者
