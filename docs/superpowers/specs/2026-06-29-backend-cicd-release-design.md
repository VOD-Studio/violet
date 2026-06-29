# 后端 CI/CD 与现代化发布流程设计

- 日期：2026-06-29
- 状态：待评审
- 作者：Yaya Touré
- 关联分支：release/2.0

## 1. 背景与目标

mimo-blog 是 Go 后端（`api/`）+ TanStack Start SSR 前端（`web/`）的 monorepo。当前已有一套"半自动"发布能力：

- `.github/workflows/ci.yml` 提供持续集成（vet/test/lint/build），但**没有任何持续交付**。
- `scripts/deploy-prod.sh` 提供手动部署：在本地机器上 `docker build` → `docker save` 打包成 `images.tar.gz` → `scp` 到 rua 服务器 → SSH 远程 `podman/docker load` + `compose up` → patch nginx → curl 验证。

这套手动流程存在明显痛点：

1. 依赖本地机器构建，开发者本机环境成为发布的关键路径。
2. 镜像靠 `docker save` + `scp` 传输 `images.tar.gz`，体积大、无版本标签。
3. 没有版本锚点，无法追溯"线上跑的是哪个版本"，也难以回滚。
4. 数据库迁移不在发布流程内，靠人手动执行，存在漏迁风险。
5. 没有健康检查门控与自动回滚，部署失败需要人工介入。

**目标**：为后端 API 建立一套现代化的、自动化的、可追溯可回滚的发布流程，消除对本地机器的依赖。

## 2. 范围与非目标

**范围内**：

- 后端 API 服务的自动化发布流水线（构建 → 迁移 → 部署 → 健康检查 → 回滚）。
- 增强现有 CI 流水线（补充分支覆盖与镜像构建验证）。
- self-hosted runner 在 rua 上的接入与安全约束。
- 数据库迁移门禁化。
- 镜像版本化与回滚机制。
- self-hosted runner 安装指南与发布手册文档。

**非目标（本期不做）**：

- 前端 `web` 的发布自动化（维持现有手动方式）。
- 预发布 / staging 环境（本期仅生产）。
- 蓝绿部署、金丝雀发布等零停机策略（单服务器单容器，接受健康检查门控下的短暂中断；未来可演进）。
- 镜像仓库方案（rua 为国内服务器，无法访问 ghcr.io；self-hosted runner 本地构建已绕开此问题）。

## 3. 关键决策与理由

| 决策 | 选择 | 理由 |
|---|---|---|
| 发布触发 | 打 Git tag（`v*`）触发；保留 `workflow_dispatch` 手动兜底 | 每次发布有明确语义化版本，可追溯、可回滚；手动入口用于紧急修复或重新部署 |
| 代码检查触发 | push / PR 触发 CI，不部署 | 快速反馈，PR 合并门禁 |
| 环境 | 仅生产（rua） | 当前规模不需要 staging |
| 部署执行位置 | self-hosted runner 跑在 rua 上 | 国内服务器无法访问 ghcr.io；runner 本地构建+部署，全程不穿越 GFW，无需镜像仓库 |
| 镜像分发 | 本地 `docker build`，不依赖 registry | self-hosted runner 与生产同机，构建产物直接本地使用 |
| 工作流拓扑 | 双工作流 `ci.yml` + `deploy.yml` | CI 与 CD 职责解耦；CD 仅在可信事件触发，满足 self-hosted runner 安全诉求 |
| 迁移门禁 | 发布流程内独立 migrate step，失败中止 | 消除漏迁风险；迁移失败绝不让新代码接管流量 |
| 回滚 | 镜像版本 tag + `workflow_dispatch` 指定历史 tag；失败自动回滚 | 本地缓存历史镜像，秒级切回 |
| 发布记录 | tag 触发时创建 GitHub Release | 与 tag 发版语义一致，沉淀变更记录 |

## 4. 架构总览

```
push / PR ──► ci.yml (GitHub-hosted runner)
                vet · test · lint · build · 镜像构建验证
                ── PR 合并门禁（任一失败阻止合并）

tag v* / workflow_dispatch ──► deploy.yml (self-hosted runner @ rua)
  ├─ checkout 代码（pin 到触发的 tag / 指定的回滚 tag）
  ├─ 记录部署上下文（记录当前生效 tag，供回滚定位）
  ├─ docker build
  │     → blog-api:<git-tag>
  │     → blog-api:latest
  ├─ DB 迁移门禁：docker compose run --rm --no-deps api /migrate up
  │     （失败 → 中止，不重启 api）
  ├─ 部署：docker compose -f docker-compose.prod.yml
  │         -f docker-compose.ci.yml up -d --no-build --no-deps api
  ├─ 健康检查：轮询 /api/health，连续 N 次成功才判定通过
  ├─ 失败 → 自动回滚：上一可用 tag 重打 latest → up -d --no-deps api
  └─ 成功 → 创建 GitHub Release（基于 tag）
```

## 5. 详细设计

### 5.1 CI 流水线（增强 `ci.yml`）

- 触发分支：`main`、`release/2.0`（补充 release 分支，与当前长期分支一致）。
- 后端 job 维持现有 `go vet` / `go test` / `golangci-lint` / `go build`。
- **新增镜像构建验证 step**：`docker build -f api/Dockerfile api/`，验证 Dockerfile 可成功构建，但不推送、不加载。目的：在 PR 阶段就拦截 Dockerfile 改坏的问题，避免拖到部署时才暴露。
- 并发取消策略保留（`cancel-in-progress: true`）。
- 前端 job 维持现状，不在本次改动范围内（仅按需补 release 分支触发）。

### 5.2 CD 发布流水线（新增 `deploy.yml`）

- 触发：
  - `push.tags: ['v*']`：正常发版。
  - `workflow_dispatch`：带 `version` 输入（可选，填历史 tag 用于手动回滚）。
- `runs-on: [self-hosted, rua]`：通过 label 精确匹配 rua 上的 runner。
- `concurrency: prod-deploy, group: ${{ github.workflow }}, cancel-in-progress: false`：生产部署串行，绝不并发，绝不取消正在进行的部署。
- 步骤序列（详见架构图）：
  1. checkout：正常发版 checkout 触发的 tag；回滚模式 checkout `version` 输入指向的 tag。
  2. 解析版本号（`github.ref_name` 或输入）。
  3. 构建镜像：`docker build -t blog-api:<tag> -t blog-api:latest ./api`（回滚模式跳过构建，复用本地缓存镜像）。
  4. 数据库迁移门禁（见 5.3）。
  5. 部署：仅重建 api 服务（见 5.5）。
  6. 健康检查门控（见 5.6）。
  7. 自动回滚（失败时，见 5.4）。
  8. 创建 GitHub Release（成功时，见 5.7）。

### 5.3 数据库迁移门禁

**现状**：`api/cmd/server/main.go` 启动时调用 `internal/migrate.RunMigrations` 自动执行迁移，失败则 `log.Fatal` 退出；镜像内没有独立的 `migrate` 二进制。迁移因此成为 server 启动的副作用，缺乏独立、可观测、可门控的步骤；更关键的是，`compose up --no-deps api` 会先停旧容器再启新容器，一旦新版本迁移失败，旧版本已被停止，无法保持线上可用。

**方案**：

- `api/Dockerfile` 额外构建 `./cmd/migrate`，产出 `/migrate` 二进制（与 `/server` 同一 builder 阶段，运行时阶段一并 COPY）。
- `deploy.yml` 在替换 api 容器**之前**，先用一次性容器执行迁移作为显式门禁：
  `docker compose -f docker-compose.prod.yml -f docker-compose.ci.yml run --rm --no-deps api /migrate up`
- 迁移 step 设为门禁：退出码非 0 则**立即中止整个部署 job**，api 容器不替换，线上继续跑旧版本。
- server 启动时的自动迁移保留作为兜底，golang-migrate `up` 幂等，已迁移时返回 `ErrNoChange`。
- golang-migrate 的版本号顺序保证向前兼容；破坏性迁移需在评审时单独关注（文档提示）。

### 5.4 镜像版本化与回滚

- 镜像标签策略：每次部署构建同时打 `blog-api:<git-tag>`（不可变版本锚点）与 `blog-api:latest`（compose 实际引用）。
- 版本锚点文件：rua 上 `/root/docker/mimo-blog/.current-version` 始终记录"当前线上生效版本"。部署 job 开始时先读取它作为回滚目标 `PREV_TAG`；部署成功并通过健康检查后，再用新版本覆盖写入。
- **自动回滚**：健康检查失败 → 在 docker 本地镜像缓存中找到部署开始时快照的 `PREV_TAG` → retag 为 `latest` → `up -d --no-build --no-deps api` → 再次健康检查 → 仍失败则 job 失败并告警（人工介入）。
- **手动回滚**：`workflow_dispatch` 带 `version=vX.Y.Z` → 跳过 build → 直接 retag 该 tag 为 latest → 迁移（向下兼容检查，失败则中止并提示）→ up → 健康检查。
- 历史镜像清理：不在本期做主动清理（docker 默认保留）；文档提示可定期 `docker image prune`。

### 5.5 compose 文件调整（兼容手动流程）

现有 `docker-compose.prod.yml` 的 api 服务用 `build: ./api`。为支持镜像版本标签与 `--no-deps` 精准重建，**新增 override 文件 `docker-compose.ci.yml`** 而非直接改 prod 文件：

- `docker-compose.ci.yml` 为 api 服务设置 `image: blog-api:latest`，使 compose 引用预先构建好的镜像而非自行构建。
- CI/CD 部署统一使用：`docker compose -f docker-compose.prod.yml -f docker-compose.ci.yml up -d --no-build --no-deps api`。`--no-build` 确保复用 deploy step 已 `docker build` 并打好 tag 的镜像（`blog-api:latest` 与 `blog-api:<tag>`），版本标签完全由 build step 掌控；`--no-deps api` 只重建 api 容器，绝不触碰 postgres / redis / web。
- 手动流程 `make deploy-remote` 仍只用 `docker-compose.prod.yml`（带 build），**完全不受影响**。

理由：override 文件实现"构建在 deploy step 显式做并打版本 tag"与"运行时引用 latest"的解耦，同时保持手动流程零回归。

### 5.6 健康检查门控

- api 容器已有 healthcheck（`wget /api/health`）。
- deploy job 在 `up -d` 后主动轮询：直接 `curl` 容器内或经 nginx 的健康端点，连续 K 次（默认 10 次，间隔 6s）成功才判定部署成功。
- 超时（默认 90s 未变 healthy）或健康检查失败 → 触发自动回滚分支。

### 5.7 GitHub Release

- tag 触发且部署成功后，用自带 `GITHUB_TOKEN` 创建 GitHub Release：
  - `tag_name`：触发的 tag。
  - `name`：版本号。
  - `body`：该 tag 与上一个 Release tag 之间的 commit 列表（`git log` 生成）。
- 回滚模式（workflow_dispatch）不创建 Release。

### 5.8 Secrets 与配置管理

- **极简原则**：self-hosted runner 与生产同机，`api/.env` 与 `secrets/jwt_*.pem` 已在 rua 本地，deploy 流程**不从 GitHub 传递任何敏感配置**。
- GitHub 侧需要的凭据：
  - 创建 Release：用 workflow 自带的 `GITHUB_TOKEN`，无需额外配置。
  - 无需 SSH key（runner 本地执行）、无需 registry 凭据、无需数据库密码。
- 文档明确：`api/.env` 与 `secrets/` 仅存在于 rua，禁止提交到仓库（`.gitignore` 已覆盖）。

### 5.9 self-hosted runner 安全

- deploy job **仅在 tag push 与手动 dispatch 时运行**，workflow 触发条件不含 `pull_request`，杜绝在 self-hosted runner 上执行未评审的 PR 代码。
- runner 注册时打 label `rua`，deploy job 用 `runs-on: [self-hosted, rua]` 精确匹配；CI 检查类 job 继续用 GitHub-hosted，绝不下放。
- `deploy.yml` 设 `environment: production`（可选）配合 GitHub 环境保护规则（required reviewers / 部署分支限制），作为额外的人工审批闸门。
- 文档化 runner 日常维护：保持 actions/runner 更新、runner 以受限用户运行、机器重启后自动拉起（systemd unit）。

## 6. 前置条件

rua 服务器需先完成一次性的 runner 接入：

1. 在 GitHub 仓库 Settings → Actions → Runners → New self-hosted runner，按指引在 rua 上注册 runner。
2. 注册时配置 label `rua`（默认含 `self-hosted`、`linux`）。
3. 安装为 systemd 服务，保证开机自启与崩溃重启。
4. 确认 rua 上 `/root/docker/mimo-blog` 目录结构、`api/.env`、`secrets/jwt_*.pem` 已就绪（首次仍由 `make deploy-prod-init` 初始化）。
5. 确认 rua 上 docker / podman 可用。

接入步骤与排错写入 `docs/` 发布手册。

## 7. 落地清单

新增：

- `.github/workflows/deploy.yml`
- `docker-compose.ci.yml`（override，api 改 image 引用）
- `docs/deploy/runner-setup.md`（self-hosted runner 安装与维护）
- `docs/deploy/release-runbook.md`（发布与回滚手册）

修改：

- `.github/workflows/ci.yml`：补 `release/2.0` 触发分支；后端 job 增加镜像构建验证 step。
- `api/Dockerfile`：builder 阶段额外构建 `migrate` 二进制，运行时阶段 COPY 到 `/migrate`。
- `Makefile`：增补 `deploy-ci`（本地触发等价流程的兜底）、`rollback`（本地手动回滚兜底）等目标。

不动：

- `scripts/deploy-prod.sh`、`docker-compose.prod.yml`：保持手动流程零回归。

## 8. 验收标准

- 打 `v*` tag 后，`deploy.yml` 在 rua runner 上自动运行至完成，API 健康检查通过，线上生效新版本。
- push / PR 触发 `ci.yml`，后端检查与镜像构建验证全部通过才允许合并。
- 数据库迁移作为部署 step 自动执行；模拟迁移失败时，部署中止且线上仍跑旧版本。
- 部署后健康检查失败时，自动回滚到 `.current-version` 记录的上一版本，线上恢复可用。
- `workflow_dispatch` 指定历史 tag 可在数秒内完成手动回滚。
- 手动流程 `make deploy-remote` 行为与改造前完全一致（回归验证）。
- rua runner 重启后能自动恢复并继续响应部署。

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| self-hosted runner 跑不可信代码 | deploy 仅响应 tag / dispatch，不响应 PR；CI 检查不 下放 |
| runner 离线导致发版卡住 | systemd 自启 + 文档监控提示；可临时 `make deploy-remote` 兜底 |
| 迁移在部署中失败导致半成品状态 | 迁移作为门禁 step，失败中止且不重启 api，线上保持旧版本 |
| 单容器重启的短暂中断 | 健康检查门控 + 快速回滚；本期接受，未来可演进双副本 |
| `--no-deps api` 依赖 postgres/redis 已在运行 | 文档明确生产环境依赖常驻；首次部署仍用完整 `make deploy-prod` |
| 回滚时迁移不兼容 | 手动回滚的迁移 step 失败则中止并提示；破坏性 down 迁移需人工评审 |
