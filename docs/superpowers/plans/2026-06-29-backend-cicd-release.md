# 后端 CI/CD 与现代化发布流程 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为后端 API 建立打 tag 自动发版、self-hosted runner 本地构建部署、含迁移门禁与自动回滚的 CI/CD 流水线。

**Architecture:** 双工作流：`ci.yml`（GitHub-hosted，push/PR 检查）+ `deploy.yml`（self-hosted runner @ rua，tag/dispatch 发版）。self-hosted runner 与生产同机，本地 `docker build` 出版本化镜像，`docker-compose.ci.yml` override 固定镜像名，`--no-build --no-deps api` 精准重建。迁移作为独立门禁 step，失败不替换 api；健康检查失败自动回滚到上一版本。

**Tech Stack:** GitHub Actions、Docker/Podman、docker compose、Go 1.25.6、golang-migrate、self-hosted runner、gh CLI。

## Global Constraints

- Go 1.25.6；二进制构建固定 `CGO_ENABLED=0 GOOS=linux`。
- 部署目标 rua：GitHub Actions self-hosted runner，label 同时含 `self-hosted` 与 `rua`；运行时为 podman 或 docker + docker compose（v2）。
- 镜像名固定 `blog-api`；tag 策略 `blog-api:<git-tag>` + `blog-api:latest`。
- 生产 compose 文件 `docker-compose.prod.yml`，CI override `docker-compose.ci.yml`；部署命令固定 `--no-build --no-deps api`。
- 远程部署目录 `/root/docker/mimo-blog`，内含 `api/.env`、`secrets/jwt_*.pem`、`.current-version`。
- 健康端点 `/api/health` 返回 `{"status":"ok",...}`；server 监听 8080。
- `api/cmd/migrate` 通过 viper `AutomaticEnv()` 读 `DATABASE_*` 等环境变量（大写下划线）；migrations 路径 `file://migrations`，镜像 WORKDIR `/app`。
- 手动流程 `make deploy-remote` 不得回归：它只用 `docker-compose.prod.yml`。
- Commit 规范：conventional commits 中文 header + bullet body，**禁止任何 footer**（无 Co-authored-by 等）。
- 注释规范：**禁止任何形式的括号补充说明**，中英文括号均不允许，把内容融入句子。
- 验证工具：actionlint（workflow 语法）、`docker build`（Dockerfile）、`docker compose config`（compose 合并）。

---

## File Structure

新增：

- `.github/workflows/deploy.yml` — CD 发布流水线，self-hosted runner 上执行构建/迁移/部署/健康检查/回滚/Release。
- `docker-compose.ci.yml` — CI override，api 服务固定 `image: blog-api:latest`。
- `docs/deploy/runner-setup.md` — rua 上 self-hosted runner 安装与维护指南。
- `docs/deploy/release-runbook.md` — 发布与回滚操作手册。

修改：

- `api/Dockerfile` — builder 额外构建 `./cmd/migrate`，运行时阶段 COPY `/migrate`。
- `.github/workflows/ci.yml` — 触发分支补 `release/2.0`；后端 job 增加镜像构建验证 step。
- `Makefile` — 增补 `deploy-ci`、`rollback` 两个 gh 触发兜底目标。

不动：`scripts/deploy-prod.sh`、`docker-compose.prod.yml`（手动流程零回归）。

---

## Task 1: Dockerfile 增加 migrate 二进制

**Files:**
- Modify: `api/Dockerfile`

**Interfaces:**
- Produces: 镜像内 `/migrate` 二进制，接受 `up|down|version|goto|force` 子命令，读 `DATABASE_*` 环境变量连接 Postgres。Task 4 的迁移门禁 step 依赖它。

- [ ] **Step 1: 确认基线——当前镜像没有 /migrate**

Run:
```bash
docker build -t blog-api:baseline ./api
docker run --rm blog-api:baseline /migrate version
```
Expected: 退出码非 0，报 `oci runtime error: exec: "/migrate": stat /migrate: no such file or directory`（证明二进制尚不存在）。

- [ ] **Step 2: 改写 Dockerfile，builder 同时构建 server 与 migrate**

将 `api/Dockerfile` 整体替换为：

```dockerfile
# 阶段1: 依赖下载
FROM golang:1.25-alpine AS deps

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# 阶段2: 构建
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
COPY --from=deps /go/pkg/mod /go/pkg/mod
COPY . .

# 构建 server 与 migrate 两个二进制，ldflags 去除调试信息减小体积
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /migrate ./cmd/migrate

# 阶段3: 运行时，保留 shell 与 wget 以便健康检查和调试
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates wget

# 创建非 root 用户，UID/GID 与 distroless nonroot 保持一致
RUN addgroup -g 65532 -S appgroup && adduser -u 65532 -S appuser -G appgroup

# 复制构建产物与迁移文件并设置所有权
COPY --from=builder --chown=appuser:appgroup /server /server
COPY --from=builder --chown=appuser:appgroup /migrate /migrate
COPY --from=builder --chown=appuser:appgroup /app/migrations ./migrations

USER appuser:appgroup

ENTRYPOINT ["/server"]
```

- [ ] **Step 3: 重新构建并验证 /migrate 可用**

Run:
```bash
docker build -t blog-api:baseline ./api
docker run --rm blog-api:baseline /migrate help
```
Expected: 打印迁移工具用法文本，包含 `up`、`down`、`version` 等命令说明，退出码 0。

- [ ] **Step 4: 确认 server 仍可正常启动**

Run:
```bash
docker run --rm --entrypoint /server blog-api:baseline -h 2>&1 | head -5 || true
```
Expected: 不报 `/server` 缺失类错误（连不上数据库会正常报错退出，重点是二进制能执行）。

- [ ] **Step 5: 提交**

```bash
git add api/Dockerfile
git commit -m "build(api): Dockerfile 增加 migrate 二进制" -m "- builder 阶段额外构建 cmd/migrate 产出 /migrate
- 运行时阶段 COPY /migrate，供 CI 迁移门禁调用"
```

---

## Task 2: 新增 docker-compose.ci.yml override

**Files:**
- Create: `docker-compose.ci.yml`

**Interfaces:**
- Produces: override 将 api 服务固定引用 `blog-api:latest` 镜像。Task 4 的 migrate/deploy step 依赖它，配合 `--no-build` 复用预构建镜像。

- [ ] **Step 1: 创建 override 文件**

写入 `docker-compose.ci.yml`：

```yaml
# CI/CD 部署专用 override
# 用法: docker compose -f docker-compose.prod.yml -f docker-compose.ci.yml up -d --no-build --no-deps api
# 将 api 服务从本地构建改为引用预构建镜像 blog-api:latest，
# 配合 --no-build 复用 deploy step 已构建并打好版本 tag 的镜像。
# 手动流程 make deploy-remote 只用 docker-compose.prod.yml，本文件不影响它。
services:
  api:
    image: blog-api:latest
```

- [ ] **Step 2: 验证 override 合并后 api.image 生效**

Run（用占位 env 满足 prod 文件的必填变量）:
```bash
POSTGRES_USER=ci POSTGRES_PASSWORD=ci POSTGRES_DB=blog \
docker compose -f docker-compose.prod.yml -f docker-compose.ci.yml config | grep -A2 '^  api:'
```
Expected: 输出包含 `image: blog-api:latest`。

- [ ] **Step 3: 验证 prod 文件单独使用时不受影响**

Run:
```bash
POSTGRES_USER=ci POSTGRES_PASSWORD=ci POSTGRES_DB=blog \
docker compose -f docker-compose.prod.yml config | grep -A3 '^  api:'
```
Expected: 输出仍含 `build:` 配置、无 `image: blog-api:latest`（证明 override 没污染手动流程）。

- [ ] **Step 4: 提交**

```bash
git add docker-compose.ci.yml
git commit -m "build(deploy): 新增 docker-compose.ci.yml override" -m "- api 服务固定引用 blog-api:latest，配合 --no-build 复用预构建镜像
- 手动流程只用 prod 文件，本 override 不影响 make deploy-remote"
```

---

## Task 3: 增强 ci.yml（补 release 分支 + 镜像构建验证）

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: push/PR 到 `main` 与 `release/2.0` 都触发检查；后端 job 新增镜像构建验证，提前拦截 Dockerfile 改坏。

- [ ] **Step 1: 整体替换 ci.yml**

将 `.github/workflows/ci.yml` 整体替换为：

```yaml
# CI 流水线
#
# PR 和 push 到 main / release/2.0 时触发，并行跑后端与前端检查。
# 后端: go vet + go test + golangci-lint + build + Docker 镜像构建验证
# 前端: biome check + tsc + vitest + build
#
# 任一 job 失败则 PR 检查失败，阻止合并。

name: CI

on:
  push:
    branches: [main, release/2.0]
  pull_request:
    branches: [main, release/2.0]

# 同一 PR 多次 push 时取消旧的运行
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ============================================================
  # 后端检查（Go）
  # ============================================================
  backend:
    name: Backend (Go)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: api

    steps:
      - uses: actions/checkout@v4

      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.25"
          cache-dependency-path: api/go.sum

      - name: Download dependencies
        run: go mod download

      - name: Go vet
        run: go vet ./...

      - name: Go build
        run: go build ./...

      - name: Go test
        run: go test ./internal/domain/... ./internal/application/... ./internal/infrastructure/... -v -count=1

      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          version: latest
          working-directory: api
          args: --timeout 5m

      - name: Docker 镜像构建验证
        run: docker build -t blog-api:ci .

  # ============================================================
  # 前端检查（TypeScript）
  # ============================================================
  frontend:
    name: Frontend (React)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Biome check
        run: pnpm lint

      - name: TypeScript check
        run: pnpm typecheck

      - name: Vitest
        run: pnpm test

      - name: Build
        run: pnpm build
```

注意：镜像构建验证 step 的 `working-directory` 继承 defaults 的 `api`，故命令是 `docker build -t blog-api:ci .`，context 即 `api/`，Dockerfile 为 `api/Dockerfile`。

- [ ] **Step 2: 用 actionlint 校验语法**

Run:
```bash
docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color
```
Expected: 无错误输出，退出码 0。若本地无 docker，可 `go install github.com/rhysd/actionlint/cmd/actionlint@latest` 后执行 `actionlint`。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 补 release/2.0 触发分支与后端镜像构建验证" -m "- push/PR 触发分支增加 release/2.0
- 后端 job 新增 Docker 镜像构建验证，提前拦截 Dockerfile 改坏"
```

---

## Task 4: 新增 deploy.yml 发布流水线

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: Task 1 的 `/migrate` 二进制、Task 2 的 `docker-compose.ci.yml`。
- Produces: 打 `v*` tag 自动发版；`workflow_dispatch` 支持 `version`（回滚）与 `skip_build` 输入。

- [ ] **Step 1: 创建 deploy.yml**

写入 `.github/workflows/deploy.yml`：

```yaml
# CD 发布流水线
#
# 触发:
#   - 打 v* tag: 自动发版到 rua 生产环境
#   - workflow_dispatch: 手动触发，可选 version 回滚到历史 tag
#
# 运行在 rua 的 self-hosted runner 上，本地构建并部署，不穿越 GFW、无需镜像仓库。
# 流程: 构建 → 迁移门禁 → 部署 api → 健康检查 → 失败自动回滚 → 创建 Release

name: Deploy

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: '目标版本 tag，用于手动回滚，如 v2.0.1。留空则部署触发的 tag。'
        required: false
        default: ''
      skip_build:
        description: '跳过构建，回滚时复用本地缓存镜像'
        required: false
        type: boolean
        default: false

# 生产部署串行，绝不并发、绝不取消进行中的部署
concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: write   # 创建 GitHub Release 需要

jobs:
  deploy:
    name: 部署到 rua 生产环境
    runs-on: [self-hosted, rua]
    environment: production
    timeout-minutes: 15
    defaults:
      run:
        shell: bash
    steps:
      - name: 解析目标版本
        id: ver
        run: |
          if [ -n "${{ inputs.version }}" ]; then
            echo "tag=${{ inputs.version }}" >> "$GITHUB_OUTPUT"
            echo "rollback=true" >> "$GITHUB_OUTPUT"
          else
            echo "tag=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
            echo "rollback=false" >> "$GITHUB_OUTPUT"
          fi
          echo "目标版本: ${{ steps.ver.outputs.tag }}"

      - name: 快照当前线上版本作为回滚目标
        id: prev
        run: |
          PREV=""
          if [ -f /root/docker/mimo-blog/.current-version ]; then
            PREV="$(cat /root/docker/mimo-blog/.current-version)"
          fi
          echo "prev_tag=${PREV}" >> "$GITHUB_OUTPUT"
          echo "当前线上版本: ${PREV:-（无，疑似首次部署）}"

      - name: Checkout 代码
        uses: actions/checkout@v4
        with:
          ref: ${{ steps.ver.outputs.tag }}

      - name: 构建镜像
        if: ${{ inputs.skip_build != 'true' }}
        run: |
          docker build \
            -t blog-api:${{ steps.ver.outputs.tag }} \
            -t blog-api:latest \
            -f api/Dockerfile api/
          echo "已构建 blog-api:${{ steps.ver.outputs.tag }} 与 blog-api:latest"

      - name: 回滚模式复用缓存镜像
        if: ${{ inputs.skip_build == 'true' }}
        run: |
          docker tag blog-api:${{ steps.ver.outputs.tag }} blog-api:latest
          echo "已将 blog-api:${{ steps.ver.outputs.tag }} 复用为 latest"

      - name: 同步 compose 文件到部署目录
        run: |
          cp docker-compose.prod.yml /root/docker/mimo-blog/docker-compose.prod.yml
          cp docker-compose.ci.yml   /root/docker/mimo-blog/docker-compose.ci.yml

      - name: 数据库迁移门禁
        working-directory: /root/docker/mimo-blog
        run: |
          docker compose \
            --env-file api/.env \
            -f docker-compose.prod.yml \
            -f docker-compose.ci.yml \
            run --rm --no-deps api /migrate up

      - name: 部署 api 服务
        id: deploy
        working-directory: /root/docker/mimo-blog
        run: |
          docker compose \
            --env-file api/.env \
            -f docker-compose.prod.yml \
            -f docker-compose.ci.yml \
            up -d --no-build --no-deps api

      - name: 健康检查
        id: health
        working-directory: /root/docker/mimo-blog
        run: |
          for i in $(seq 1 15); do
            if docker compose exec -T api wget -qO- http://localhost:8080/api/health 2>/dev/null | grep -q '"status":"ok"'; then
              echo "健康检查通过，第 ${i} 次尝试"
              exit 0
            fi
            echo "等待 api 就绪 (${i}/15)..."
            sleep 6
          done
          echo "::error::健康检查失败，api 未在超时内就绪"
          exit 1

      - name: 自动回滚到上一版本
        if: failure() && steps.prev.outputs.prev_tag != '' && steps.ver.outputs.rollback != 'true'
        working-directory: /root/docker/mimo-blog
        run: |
          PREV="${{ steps.prev.outputs.prev_tag }}"
          echo "部署失败，自动回滚到 ${PREV}"
          docker tag "blog-api:${PREV}" blog-api:latest
          docker compose \
            --env-file api/.env \
            -f docker-compose.prod.yml \
            -f docker-compose.ci.yml \
            up -d --no-build --no-deps api
          for i in $(seq 1 10); do
            if docker compose exec -T api wget -qO- http://localhost:8080/api/health 2>/dev/null | grep -q '"status":"ok"'; then
              echo "回滚成功，线上已恢复到 ${PREV}"
              exit 0
            fi
            sleep 6
          done
          echo "::error::回滚后健康检查仍失败，需人工介入"
          exit 1

      - name: 更新版本锚点
        if: success() && steps.ver.outputs.rollback != 'true'
        run: |
          echo "${{ steps.ver.outputs.tag }}" > /root/docker/mimo-blog/.current-version
          echo "版本锚点已更新为 ${{ steps.ver.outputs.tag }}"

      - name: 创建 GitHub Release
        if: success() && github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.ver.outputs.tag }}
          generate_release_notes: true
```

关键点说明（实现者必读）：
- `runs-on: [self-hosted, rua]` 只匹配 rua 上带 `rua` label 的 runner；CI 检查 job 绝不下放到它。
- 迁移 step 用 `run --rm --no-deps`：一次性容器复用 api 服务的 `env_file` 与 `environment`（其中 `DATABASE_HOST=postgres`），连到生产 Postgres；`--no-deps` 不重建依赖，postgres/redis 必须已在运行。
- `--no-build --no-deps api` 只重建 api 容器，镜像来自 build step。
- 手动回滚（`skip_build=true`）靠「回滚模式复用缓存镜像」step 把目标 tag retag 为 latest，否则部署的仍是当前 latest 而非目标版本。
- 自动回滚仅在「非回滚模式」且存在 `prev_tag` 时触发，避免回滚失败又触发回滚。
- GitHub Release 仅 tag push 且非回滚模式时创建，用 `generate_release_notes` 自动生成变更记录。

- [ ] **Step 2: 用 actionlint 校验语法**

Run:
```bash
docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color
```
Expected: 无错误，退出码 0。常见报错自查：`if` 表达式里的 `${{ }}` 必须包裹整个表达式；`inputs.*` 在 push 事件下为空字符串属正常。

- [ ] **Step 3: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci(deploy): 新增后端生产发布流水线 deploy.yml" -m "- tag push 与 workflow_dispatch 触发，self-hosted runner 跑在 rua
- 构建 → 迁移门禁 → 部署 api → 健康检查 → 失败自动回滚
- 版本锚点 .current-version + GitHub Release 自动生成变更记录"
```

---

## Task 5: Makefile 增补 gh 触发兜底目标

**Files:**
- Modify: `Makefile`

**Interfaces:**
- Produces: `make deploy-ci`（手动触发 deploy）、`make rollback v=vX.Y.Z`（手动回滚）。

- [ ] **Step 1: 在 .PHONY 与远程部署段后追加目标**

在 `Makefile` 顶部 `.PHONY` 行追加 `deploy-ci rollback`（合并进现有 `.PHONY` 列表，保持字母顺序可读）。

然后在「远程部署 (rua)」段末尾、「工具」段之前插入：

```makefile
# ==================== CI/CD 触发 (gh CLI) ====================

deploy-ci: ## 手动触发 deploy 工作流部署最新代码，需 gh CLI 已登录
	@command -v gh >/dev/null 2>&1 || { echo "✗ 需安装并登录 gh CLI"; exit 1; }
	gh workflow run deploy.yml
	@echo "✅ 已触发 deploy 工作流，查看: gh run list --workflow=deploy.yml"

rollback: ## 回滚到历史版本，用法: make rollback v=v2.0.0
	@if [ -z "$(v)" ]; then echo "用法: make rollback v=v2.0.0"; exit 1; fi
	@command -v gh >/dev/null 2>&1 || { echo "✗ 需安装并登录 gh CLI"; exit 1; }
	gh workflow run deploy.yml -f version=$(v) -f skip_build=true
	@echo "✅ 已触发回滚到 $(v)，查看: gh run list --workflow=deploy.yml"
```

- [ ] **Step 2: 验证 make help 能列出新目标**

Run:
```bash
make help | grep -E 'deploy-ci|rollback'
```
Expected: 两行均出现，带说明文字。

- [ ] **Step 3: 验证 rollback 无参数给出用法提示**

Run:
```bash
make rollback 2>&1 | grep '用法'
```
Expected: 输出 `用法: make rollback v=v2.0.0`。

- [ ] **Step 4: 提交**

```bash
git add Makefile
git commit -m "build: Makefile 增补 deploy-ci 与 rollback 兜底目标" -m "- deploy-ci 手动触发 deploy 工作流
- rollback v=X 回滚到历史版本，复用本地缓存镜像"
```

---

## Task 6: self-hosted runner 安装指南

**Files:**
- Create: `docs/deploy/runner-setup.md`

- [ ] **Step 1: 写入 runner-setup.md**

写入 `docs/deploy/runner-setup.md`：

````markdown
# rua self-hosted Runner 安装指南

CI 检查跑在 GitHub-hosted runner；生产部署跑在 rua 上的 self-hosted runner。本指南记录 rua 上一次性接入与日常维护。

## 前置条件

- rua 可访问 `https://github.com`（拉取 runner 发行包与 checkout 代码）。
- rua 已安装 docker 或 podman + docker compose / podman-compose。
- `/root/docker/mimo-blog` 已就绪：含 `api/.env`、`secrets/jwt_private_key.pem`、`secrets/jwt_public_key.pem`。

## 注册 runner

1. 仓库 Settings → Actions → Runners → New self-hosted runner → Linux。
2. 在 rua 按 GitHub 给出的命令下载、解压、配置：
   ```bash
   cd /root/actions-runner
   ./config.sh --url https://github.com/<owner>/<repo> --token <token> --labels "rua"
   ```
   关键：`--labels "rua"`，`deploy.yml` 用 `runs-on: [self-hosted, rua]` 精确匹配。
3. 注册时交互项：runner 名随意；工作目录用默认 `_work`；label 已由参数指定。
4. 安装为 systemd 服务，保证开机自启与崩溃重启：
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

## 验证

- GitHub 仓库 Settings → Actions → Runners 出现 Idle 状态、带 `self-hosted` 与 `rua` 两个 label 的条目。
- rua 上 `sudo systemctl status actions.runner.*` 为 active (running)。

## 安全约束

- `deploy.yml` 只在 tag push 与手动 dispatch 时运行，不响应 pull_request，避免在 rua 执行未评审代码。
- runner 进程以受限用户运行，不要用 root 注册。
- 保持 runner 更新：定期 `cd /root/actions-runner && sudo ./svc.sh stop && ./config.sh --ephemeral` 或下载新版替换后重启服务。

## 排错

- **deploy 一直 pending**：runner 离线。检查 `systemctl status`、网络、磁盘空间。
- **checkout 失败**：rua 访问 github.com 超时，检查出网。
- **migrate 步骤连不上 postgres**：确认 postgres 容器在 `blog_network` 内健康，`api/.env` 与 `docker-compose.prod.yml` 的 `DATABASE_HOST=postgres` 一致。
````

- [ ] **Step 2: 提交**

```bash
git add docs/deploy/runner-setup.md
git commit -m "docs(deploy): rua self-hosted runner 安装与维护指南" -m "- 记录注册、systemd 服务化、label 配置
- 安全约束与常见排错"
```

---

## Task 7: 发布与回滚操作手册

**Files:**
- Create: `docs/deploy/release-runbook.md`

- [ ] **Step 1: 写入 release-runbook.md**

写入 `docs/deploy/release-runbook.md`：

````markdown
# 后端发布与回滚手册

## 发版流程（打 tag）

1. 确认 `release/2.0` 分支代码已通过 CI（Backend / Frontend 全绿）。
2. 打语义化版本 tag 并推送：
   ```bash
   git tag v2.0.1
   git push origin v2.0.1
   ```
3. `Deploy` 工作流自动触发：构建镜像 → 迁移门禁 → 部署 api → 健康检查 → 创建 GitHub Release。
4. 在 Actions 页或 `gh run list --workflow=deploy.yml` 观察结果；成功后线上版本写入 `/root/docker/mimo-blog/.current-version`。

健康检查失败会自动回滚到 `.current-version` 记录的上一版本；若回滚后仍失败，工作流报错，需人工介入。

## 手动重新部署

```bash
make deploy-ci
# 或：在 Actions → Deploy → Run workflow
```

## 手动回滚

前提：目标历史 tag 的镜像仍在 rua 本地缓存（docker 不会主动清理）。

```bash
make rollback v=v2.0.0
# 或：Actions → Deploy → Run workflow → 填 version=v2.0.0，勾选 skip_build
```

回滚会 checkout 旧 tag、复用缓存镜像、重新迁移（幂等）、重启 api。注意：

- 回滚假设 schema 向后兼容。若待回滚的新版本含破坏性迁移（删列、改类型），回滚前需在 rua 手动 `make migrate-down` 或用 `go run ./cmd/migrate goto <v>`，并人工评审。
- 回滚成功后 `.current-version` 不变（回滚不更新锚点），便于再次前进。

## 迁移门禁失败处理

迁移 step 失败时 api 容器不会被替换，线上继续跑旧版本。常见原因：

- 迁移 SQL 语法错误：修迁移文件，重新打 tag。
- dirty 状态：在 rua 执行 `docker compose run --rm --no-deps api /migrate version` 查看，必要时 `/migrate force <v>` 修复。

## 紧急情况：CI 不可用时的手动兜底

self-hosted runner 离线又急需发版时，用原手动流程（不影响 CI 已配置的内容）：

```bash
make deploy-remote
```

该流程独立于 CI，使用 `docker-compose.prod.yml` 自行构建。
````

- [ ] **Step 2: 提交**

```bash
git add docs/deploy/release-runbook.md
git commit -m "docs(deploy): 后端发布与回滚操作手册" -m "- 打 tag 发版、手动重部署、手动回滚
- 迁移门禁失败与紧急手动兜底流程"
```

---

## 全量验证（Task 7 后执行）

- [ ] **V1: actionlint 全绿**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: 退出码 0。

- [ ] **V2: 本地镜像端到端构建+迁移二进制可用**

Run:
```bash
docker build -t blog-api:ci ./api
docker run --rm blog-api:ci /migrate help
```
Expected: migrate 帮助文本输出，退出码 0。

- [ ] **V3: compose override 合并正确**

Run:
```bash
POSTGRES_USER=ci POSTGRES_PASSWORD=ci POSTGRES_DB=blog \
docker compose -f docker-compose.prod.yml -f docker-compose.ci.yml config | grep 'image: blog-api:latest'
```
Expected: 命中一行。

- [ ] **V4: Makefile 新目标可见**

Run: `make help | grep -E 'deploy-ci|rollback'`
Expected: 两行命中。

- [ ] **V5: 手动流程未回归**

Run: `git diff scripts/deploy-prod.sh docker-compose.prod.yml`
Expected: 无输出（这两个文件未被改动）。

> 真实的 tag 触发验证需在 runner 接入后于 GitHub 上完成：打一个测试 tag，确认 Deploy 工作流在 rua runner 上跑通，API 健康检查通过。
