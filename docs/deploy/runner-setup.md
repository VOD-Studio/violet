# 自托管 Runner 运维指南

CI 默认使用 GitHub-hosted runner，`SELF_HOSTED_RUNNER=true` 时可选择 Omarchy runner；生产部署固定使用 rua runner。两者的注册信息、工作目录和 Docker 状态独立。

## Omarchy CI 镜像

镜像和 Compose 的源码在 `deploy/github-runner/`，本机部署目录为 `/run/media/xfy/WDC4TB/srv/github-runner`。从仓库根目录构建并检查：

```bash
make runner-image
make runner-check
```

系统依赖在 Dockerfile 构建阶段安装，Go、Node 与 pnpm 版本由工作流声明。Chromium 的系统库清单对应 [Playwright 1.63.0 的 Ubuntu 24.04 tools/chromium 依赖](https://github.com/microsoft/playwright/blob/v1.63.0/packages/playwright-core/src/server/registry/nativeDeps.ts)，升级 Playwright 后需重新验收浏览器契约测试。镜像中的 `/etc/violet-runner-packages.txt` 保存实际安装版本。

更新部署前确认 runner 空闲，备份现有 Dockerfile、Compose、脚本和 `.env`，记录旧镜像 ID。仅同步受版本管理的源码，保留 `.env`、`.secrets` 和已有命名卷；在 `.env` 中将 `RUNNER_IMAGE` 设为新镜像 ID，然后在部署目录执行：

```bash
docker compose config --quiet
docker compose up -d --no-deps --wait --wait-timeout 180 runner
docker compose exec -T runner runner-check-environment
docker compose exec -T runner bash -s < scripts/docker-smoke-test.sh
```

`--no-deps` 保留 DinD 和已有镜像缓存。回滚时恢复 `.env` 中的旧镜像 ID，再执行同一个 `up` 命令；不要删除 runner-home、runner-work 或 docker-data 卷。系统库位于镜像的 `/usr`，已有 `/home/runner` 卷不会遮挡这些依赖。基础检查和 Docker smoke test 通过后，仍须执行完整 GitHub CI 才能启用自托管。

## 完整 CI 验收与启用

更新镜像期间保持仓库变量 `SELF_HOSTED_RUNNER=false`。新分支修改 runner 源码或相关工作流并推送后，`Runner acceptance` 自动调用同一份 `ci.yml`，固定当前 SHA、强制双侧检查和双侧镜像构建。它允许在线但忙碌的 runner 排队；离线、查询失败、缺少状态 token 或不可信触发事件会失败，不回退官方 runner。

```bash
branch=$(git branch --show-current)
gh run list --workflow runner-acceptance.yml --branch "$branch"
gh run view <run-id> --json headSha,status,conclusion,jobs
gh api repos/VOD-Studio/violet/actions/runs/<run-id>/jobs \
  --jq '.jobs[] | {name, runner_name, conclusion, steps: [.steps[] | {name, conclusion}]}'
```

验收要求 Backend、Frontend、Infrastructure、Dependency Security 均由 `vod-omarchy-docker-01` 实际执行成功；变更检测和选择 runner 的控制作业仍在官方 runner 上。核对 Go 单元与迁移测试、浏览器契约测试、双侧 Docker 构建均执行，不能把 skip 或官方 runner 重跑结果作为验收。前端 `pnpm audit` 沿用既有 advisory 规则。

CI PostgreSQL 的数据目录使用上限 1 GiB 的 tmpfs，数据只保留在 job 生命周期内。仓储测试为每例创建 schema 并执行全部迁移；在机械盘上的 DinD 数据目录中，这些同步写入曾使测试包超过 Go 默认的 10 分钟超时。tmpfs 用于消除这一存储瓶颈，仍执行相同的 PostgreSQL 事务和迁移测试。

自托管的 Backend、Frontend 作业上限为 40 分钟，覆盖首次安装工具、下载浏览器和远程 Docker 缓存的耗时；官方 runner 保持 20 分钟。Go 测试自身仍使用默认的 10 分钟上限。Docker 缓存仅由 `main`、`release/2.0` 的 push 上传，验收分支只读取缓存；缓存传输耗时不能当作测试失败，也不能将已超时的作业算作验收成功。

新工作流合入 `release/2.0` 后也可手动执行：

```bash
gh workflow run runner-acceptance.yml --ref release/2.0
```

启用前先合入已通过验收的工作流，再设置：

```bash
gh variable set SELF_HOSTED_RUNNER --body true
```

旧工作流的 `playwright install --with-deps` 会尝试 sudo，而 runner 启用了 `no-new-privileges`；仅更新镜像不能解决这个调用。新版自托管路径只下载 Chromium，系统库由镜像提供。停用时将变量设回 `false`；已排队或运行的作业不会因此迁移到官方 runner。日常选择的在线/空闲检查不预留容量。

## rua 部署 Runner

## 前置条件

- rua 可访问 `https://github.com`（拉取 runner 发行包与 checkout 代码）。
- rua 已安装 docker 或 podman + docker compose / podman-compose。
- `/root/docker/violet` 已就绪：含 `.env`。

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

### 部署出网

Runner 服务和部署 job 使用 `http://127.0.0.1:20171`，大小写代理变量保持一致。API 的业务外呼仍使用分流端口 `20172`；两端口中的 GitHub、GHCR、GitHub 静态资源和 Azure Blob 日志流量都由 `github-actions` balancer 处理。

仓库脚本 [`scripts/v2ray-feed-fix.py`](../../scripts/v2ray-feed-fix.py) 安装到服务器 `/usr/local/bin/v2ray-feed-fix.py`，由 `v2ray-feed-fix.timer` 每五分钟执行，维护 `/etc/v2raya/config.json`：

- `github-actions` 按 `https://github.com/robots.txt` 的实际可达性选出口，不再固定到单个节点，也不借用 Google 探测结果。
- 节点域名使用 `1.1.1.1` 与 `9.9.9.9` 的 TCP DNS，匹配后不退回普通解析。其他域名保留既有 DNS。
- V2Ray 5.12 的节点拨号须通过 `node-dialer` freedom outbound（`UseIPv4`），并设置 `proxySettings.transportLayer=true` 保留原传输和 TLS。仅设置 `sockopt.domainStrategy` 不会让节点拨号改用内置 DNS。
- 配置变更先通过 `v2ray test`，再原子替换并重载核心；配置未变时不重启。保留 service 的 `KillMode=process`，否则 oneshot 退出可能回收它启动的核心。

改代理前备份配置和维护脚本。重载会中断代理连接，需安排维护窗口；不要重启 API、Web 或数据库来排查 TLS 建连问题。只修改生成的 `config.json` 不足以跨 v2rayA 配置重建保留策略。

在已有维护 service 的服务器上，从仓库根目录更新脚本：

```bash
sudo install -m 0755 scripts/v2ray-feed-fix.py /usr/local/bin/v2ray-feed-fix.py
sudo systemctl start v2ray-feed-fix.service
sudo systemctl is-active v2ray-feed-fix.timer
```

在服务器检查完整链路：

```bash
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://github.com/robots.txt
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://ghcr.io/v2/
curl -sS --proxy http://127.0.0.1:20171 --connect-timeout 8 --max-time 12 \
  -o /dev/null -w '%{http_code}\n' https://broker.actions.githubusercontent.com/health
```

依次应为 `200`、`401`、`200`。GHCR 的匿名 `401` 只证明 TLS 与仓库服务可达，不证明发布凭据有效。验证应跨越维护 timer 周期，并确认核心 PID 不变。

## 安全约束

- `deploy.yml` 只在 tag push 与手动 dispatch 时运行，不响应 pull_request，避免在 rua 执行未评审代码。
- runner 进程以受限用户运行，不要用 root 注册。
- 保持 runner 更新：下载新版 actions-runner 包解压覆盖原目录后，执行 `sudo ./svc.sh stop && sudo ./svc.sh install && sudo ./svc.sh start` 重启服务。

## 排错

- **deploy 一直 pending**：runner 离线。检查 `systemctl status`、网络、磁盘空间。
- **checkout 失败**：rua 访问 github.com 超时，检查出网。
- **步骤失败后 job 长时间不结束，日志下载返回 `BlobNotFound`**：读取 `/root/actions-runner/_diag/Worker_*.log` 的 `JobServerQueue`。结果服务或 Azure Blob 不通时，日志上传重试会拖延 job 收尾；只测 `github.com` 不够。
- **migrate 步骤连不上 postgres**：确认 postgres 容器在 `violet_network` 内健康，`.env` 与 `docker-compose.prod.yml` 的 `DATABASE_HOST=postgres` 一致。
