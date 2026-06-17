# Docker Compose 生产部署验证报告

**计划:** `docs/superpowers/plans/2026-06-17-docker-compose-full-deployment.md`  
**任务:** Task 4 - 验证生产部署  
**执行时间:** 2026-06-17  
**执行环境:** `/home/xfy/Developer/mimo-blog/.worktrees/docker-compose-full-deploy` (branch `feat/docker-compose-full-deploy`)

## 执行步骤与结果

### Step 1: 检查并配置 `api/.env`

- 检查发现 `POSTGRES_PASSWORD` 和 `SUPERADMIN_PASSWORD` 仍为占位值 `changeme-strong-password`。
- 已将其更新为强度足够的非空密码（具体值存储于 `api/.env`，未写入本报告）。

### Step 2: 初始化 JWT 密钥

运行 `./scripts/init-production.sh`：

```text
初始化完成

下一步：
  make deploy-prod
```

JWT 密钥对已存在，初始化成功。

### Step 3: 构建并启动生产容器

运行 `make deploy-prod`。

**结果：失败（BLOCKED）**。Web 前端镜像构建失败，错误如下：

```text
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 1 lockfile entries failed verification:
  lucide-react@1.20.0 was published at 2026-06-16T13:22:47.000Z, within the minimumReleaseAge cutoff (2026-06-16T06:40:06.789Z)

The lockfile contains entries that the active policies reject. This can mean the lockfile is stale, or that someone committed a lockfile that bypassed the policy locally — inspect recent changes to pnpm-lock.yaml before trusting it. If the changes look expected, run "pnpm clean --lockfile" and then "pnpm install" to rebuild from a fresh resolution. Alternatively, relax the policy that flagged it.
```

Docker 构建最终输出：

```text
Dockerfile:23
--------------------
  21 |     
  22 |     # 安装依赖（frozen-lockfile 保证可复现）
  23 | >>> RUN pnpm install --frozen-lockfile
  24 |     
  25 |     # 拷贝源码
--------------------
target web: failed to solve: process "/bin/sh -c pnpm install --frozen-lockfile" did not complete successfully: exit code: 1

make: *** [Makefile:138: deploy-prod] Error 1
```

### Step 4-7: 健康检查与访问验证

由于 Step 3 构建失败，容器未成功启动，以下验证步骤**未能执行**：

- Step 4: `docker compose --env-file api/.env -f docker-compose.prod.yml ps`
- Step 5: `curl -s http://localhost/api/health | jq .`
- Step 6: `curl -s http://localhost/ | head -n 20`
- Step 7: `curl -s -X POST http://localhost/api/v1/auth/login ...`

运行 `docker compose ps` 确认无容器在运行：

```text
NAME      IMAGE     COMMAND   SERVICE   CREATED   STATUS    PORTS
```

### Step 9: 停止部署

运行 `make deploy-prod-down`，由于无运行中的容器，命令成功完成，无残留服务。

## 结论

**状态：BLOCKED**

生产部署验证未能完成，阻塞原因是 Web 前端 Docker 镜像构建时 pnpm 的 `minimumReleaseAge` 供应链策略拒绝了 `lucide-react@1.20.0`（该版本发布时间过于接近构建时间）。

修复建议（供上游 Task 1-3 参考）：

1. 在 `web/pnpm-lock.yaml` 中重新解析 `lucide-react` 依赖（`pnpm clean --lockfile && pnpm install`）。
2. 或在 `web/.npmrc` / `package.json` 中显式配置 `onlyBuiltDependencies` 或放宽 `minimumReleaseAge` 策略，以允许使用新发布包。
3. 待构建成功后，重新执行 Task 4 验证流程。
