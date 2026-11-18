# violet (blog-project)

全栈博客平台 monorepo。

## 架构与代码边界
后端是 Go、Chi、PostgreSQL 和 Redis；前端是 React、Vite、Tailwind CSS、Zustand 和 TanStack Query。前端只用 `pnpm`，不用 npm 或 yarn。

### 架构耦合约束

- 后端只用 DDD 分层：`api/internal/domain` 管业务不变量，`application` 编排用例，`infrastructure` 实现适配器，`interfaces` 处理 HTTP。`app` 手工装配容器，不用 Wire。`internal/middleware/` 只放通用横切逻辑。新增模块见[后端分层与装配](api/README.md#分层与新增模块)。
- 前端按实际消费方归属：跨 feature 的通用控件和语义 token 进 `web/packages/ui/`，站点从 `@violet/ui` 根入口消费；站点专用基础能力进 `web/src/shared/`，有业务语义的共用逻辑进 `web/src/entities/`，只服务一个 feature 的逻辑留在该 feature。站点方言留在 `web/src/styles/dialects/`。依赖从上层指向下层：`widgets` → `features` → `entities` → `shared`，下层不反向依赖业务。
- 页面稿决定布局、内容和流程，已有组件的外观、交互和 API 以当前组件契约为准。先复用，确有缺口再扩展，不为旧稿复制控件。见 [ADR-0030](docs/adr/0030-frontend-pages-use-existing-components.md)。

## 开发流与命令 (Makefile)

在仓库根目录运行 `make help` 查目标，`make dev` 启动开发环境，`make migrate` 执行数据库迁移。

| 改动 | 动笔前 | 验证入口 |
| --- | --- | --- |
| 后端 | Go 版本见 [`api/go.mod`](api/go.mod)。本机缺 Go 时按 [api-toolchain](.agents/skills/api-toolchain/SKILL.md) 问一次使用本机还是容器，不自行安装。 | `make api-test`、`make api-lint`；未装 golangci-lint 时后者回退到 `go vet`。 |
| 站点前端 | 组件、hook、工具和测试先读 [frontend-conventions](.agents/skills/frontend-conventions/SKILL.md)；编辑 `className` 还须读 [tailwind-canonical-classes](.agents/skills/tailwind-canonical-classes/SKILL.md)，写完按对应规范自查。 | `make web-lint`、`make web-typecheck`、`make web-test`；`make web-format` 会写回文件。 |
| UI 设计与组件包 | 做设计决策先读[组件架构](web/packages/ui/docs/architecture.md)和[组件设计方法](web/packages/ui/docs/component-design.md)。新增或迁移单元以 [manifest](web/packages/ui/component-manifest.json) 为准。 | 按 [violet-ui](.agents/skills/violet-ui/SKILL.md) 验收包内行为、真实 tarball 和实际消费页面，三者不互相替代。 |

## 分支命名

分支名用 `<type>/<scope>-<简述>`，例如 `fix/handler-search-encoding`。type 对应变更性质，scope 取最内层模块，跨模块且难以归属时可省略。简述用小写英文或拼音，词间用 `-`。

### 需求与实施分支

同一功能的需求文档（PRD）与实施归属同一功能分支，不另建 `docs/*-prd` 分支。实施子任务可从功能分支切出，也可直接在功能分支提交。需求建 GitHub 父议题，实施任务建子议题，仓库不复制正文；只有 `gh` 不可用才用[本地记录](docs/agents/issue-tracker.md#fallback-local-markdown-when-gh-is-unavailable)。跨功能的独立流程规范可用 `docs/` 分支。

## 按任务查阅

- 查领域术语用根 [CONTEXT.md](CONTEXT.md)，检查既有决策见[领域指南](docs/agents/domain.md)。
- 功能、模块或架构变化时，按[文档责任地图](docs/agents/docs-map.md)同步对应文档，与所属改动一起提交。
- 只有用户主动要求写文章、改稿、记笔记或出版时才使用 [blog-writing](.agents/skills/blog-writing/SKILL.md)。不在会话结束时自动写作；保存、上传和发布沿用用户已有授权，不默认执行。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 前端视觉红线

改动滚动区或折叠容器后，用 Tab 和点击检查可聚焦控件四边的聚焦环。站点圆角、投影、颜色和裁剪处理见[站点视觉与焦点](docs/guides/frontend-style-guide.md#站点视觉与焦点)。

## 提交流程规范

有入库改动就本地提交，默认不推送。只读分析、答疑或评审不需要为交付建分支或制造空提交。

### 提交步骤

**提交时机看改动是否完整。** 一个功能点、修复或文档改动完成，能独立说明、独立回退，就本地提交，再做下一项。不要把多个已完成项积到任务末尾再按 hunk 拆，也不为凑提交数拆出不能独立工作的半成品。

**验证频率看风险，不看提交次数。** 纯文档改动核对内容与引用即可；改了行为或接口，选能覆盖风险的最小检查。相关输入和环境未变时，复用已有结果。多个提交共用的构建、集成或端到端测试，在依赖接通后或由 CI 跑一次，不逐提交重复全量检查。

每次只选择本项的路径或 hunk，保留用户和其他任务的改动。交付时说明哪些检查实际跑过、哪些复用了已有结果；待 CI 执行的检查不算已通过。

### 原子性

这里是通用原子性判据的唯一维护处。一个提交解决一个问题，带上该行为必需的测试、生成物与文档，不按文件或技术层机械拆分。

每个提交连同前置提交都应可构建、可验证，按依赖逆序回退仍有效。若拆分改变了依赖关系，只补验原结果未覆盖的中间状态，不能用最终结果代替。交付前整理本任务未共享的 WIP；重写已共享或他人历史须先获授权。

### 职责边界

| 改动边界 | 如何提交 |
| --- | --- |
| 后端 API 与前端 | 分开提交，接口提供方在先。 |
| `web/packages/ui/` 与站点 | 组件实现、CSS、清单、导出、测试、消费 fixture 与包文档一起提交；站点接入另提，即使只有一个消费方。 |
| 站点 `shared` / `entities` 与 feature | 先提交可独立验收的公共能力或修复，再提交 feature 接入。 |
| feature 私有行为 | 同一行为的组件、hook、状态和测试一起提交。无关修复、格式化或流程规则另提。 |

### 依赖与迁移

迁移先在目标包提供完整实现，保留旧调用链；再切换所有消费方，同时删除旧实现、导出与过期测试。若破坏性接口无法按此顺序拆分，提交前列出受影响的符号、调用方和失败环节，请用户决定。

### 提交信息

使用中文 Conventional Commits：`<type>(<scope>): <subject>`。scope 取最小改动单元；标题用祈使句，宜在 50 字内，不用 `+`、`、` 或连接词堆砌独立要点。正文用 bullet 列改动事实，决策理由放 PR 或 ADR。纯文档或流程规则用 `docs`，不用发版型 type。

## 代码注释规范

注释写契约、不变量和陷阱，不复述签名。改 Go 结构体前看[字段注释规则](api/README.md#go-注释)：领域实体和值对象的命名字段必注，对外 DTO 只注释无法推断的语义。

## 议题与合并

- 议题标题用 `[scope] 描述`。普通建单默认不加标签，外部议题才走[分诊](docs/agents/triage-labels.md)。建单与子任务操作见[任务跟踪指南](docs/agents/issue-tracker.md)。
- PR 的目标分支为 `release/2.0`。默认不指定经办人或评审人，不加标签，不启用自动合并。如何关联议题和手动合并见[贡献指南](CONTRIBUTING.md#提交-pr-流程)。
- 普通 PR 用 merge commit，release-please 的发版 PR 用 squash。用户未要求时不写 `Release-As`；明确指定版本时按[发布手册](docs/deploy/release-runbook.md#多个-pr-与补丁版本)为整个批次设置一次。
