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

准备提交到 `release/2.0` 的改动使用贡献分支；已有功能的实施子任务也可从该功能分支切出。只读评审不需要建分支。分支名格式与需求归属见[仓库分支规范](AGENTS.md#分支命名)。

## 提交规范（Conventional Commits）

使用[中文提交格式](AGENTS.md#提交信息)。按[职责边界](AGENTS.md#职责边界)拆分：接口、通用组件先提交，业务接入后提交；同一行为的实现与测试一起提交。每个中间状态都须满足[原子性判据](AGENTS.md#原子性)。

## 代码规范

### 后端 (Go)

- 检查与测试：`make api-lint`、`make api-test`。
- 后端只用 [DDD 分层和手工装配](api/README.md#分层与新增模块)。改实体、值对象或对外数据结构前，看 [Go 注释规则](api/README.md#go-注释)。

### 前端 (TypeScript)

- 包管理器：**pnpm**，禁止 npm / yarn
- 检查 / 测试：`make web-lint`（Biome）、`make web-typecheck`（tsc）、`make web-test`（Vitest）；`make web-format` 自动修复
- 按[架构耦合约束](AGENTS.md#架构耦合约束)区分组件包、站点公共层和业务模块；站点布局及焦点验收见[前端代码规范](docs/guides/frontend-style-guide.md)。

### 通用

- 缩进：tab（Go 与前端统一 tab 4，见 `.editorconfig`）；YAML 与根级 JSON 用 2 空格
- 换行符：LF，文件末尾保留空行
- 配置/文档改动若涉及配置架构，遵循 Grafana 模式：`api/config.yaml` 入库为权威文档，敏感值一律走根 `.env`

## 提交 PR 流程

1. 开发中按[提交时机与验证范围](AGENTS.md#提交步骤)提交完整的逻辑变更；准备开 PR 时核对验证结果，再推送分支。
2. 以 `release/2.0` 为目标分支。标题只写一个目的，不用 `+` 或 `、` 堆叠变更；正文列动机、破坏性变更（如有）和实际验证结果。
3. 默认不指定经办人和评审人，也不加标签。确为缺陷或纯文档改动时可用 `bug` 或 `documentation`，不用流程标签。
4. 合并后应关闭的议题在正文写 `Closes #N` 或 `Fixes #N`；只作关联时写 `#N`，不要触发关闭。
5. 等待 CI 通过、人工评审同意，再手动合并，不启用自动合并。普通 PR 使用 merge commit，release-please 创建的发版 PR 使用 squash。合并后删除已合并的分支。

## 发版流程（release-please 自动化）

站点版本和更新日志由 release-please 维护。未明确要求指定版本时不写 `Release-As`。版本意图、发布候选、部署结果与回滚以[发布手册](docs/deploy/release-runbook.md)为准；release PR 合并不等于已经上线。

## 测试要求

- 新功能必须附带单元测试；Bug 修复应包含回归测试
- 后端：`make api-test`（domain 层聚合根不变量 + application 层用例编排）
- 前端：`make web-test`（Vitest + React Testing Library）
- 后端 DDL 类改动（uuid/jsonb 等强类型列）建议跑真实 PostgreSQL 端到端验证

## 问题与反馈

- 发现 Bug：创建 Issue，附复现步骤与日志
- 新功能建议：创建 Issue 描述使用场景
- 安全漏洞：请勿公开 Issue，私信维护者
