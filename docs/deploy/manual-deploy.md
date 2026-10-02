# 手动部署与服务器前置配置

日常发布使用 [发布与回滚手册](release-runbook.md)。Runner 不可用时，SSH 入口仍调用 `scripts/deploy-release.py`，共用生产锁、迁移门禁、归档与健康检查。

## 连接与运行环境

生产主机 SSH 端口为 `29888`。给本机配置别名后，下面命令统一使用该别名：

```sshconfig
Host rua
    HostName xunrua.top
    User root
    Port 29888
```

```bash
ssh rua 'bash -lc "python3 --version && docker compose version && podman --version"'
```

服务器使用 Podman；`docker` 为兼容入口，`docker compose` 调用外部 Docker Compose provider。2026-10-02 只读检查为 Podman 5.8.2、Docker Compose 5.1.4、Python 3.9.25。部署脚本需要 Python 3.9+ 与支持 `--project-directory` 的 Docker Compose provider。服务器默认 shell 为 fish，复杂命令显式使用 `bash -lc`。

部署目录 `/root/docker/violet` 必须已有 `.env`、secrets、两份 Compose 文件、运行中的数据库与服务。外部 nginx-proxy 网络、TLS 反代和共享资源目录需预先就绪。该入口接管已有部署，不负责空机初始化。

## SSH 回滚

```bash
./scripts/deploy-prod.sh --host rua --rollback v2.0.1
# 或
make deploy-remote-skip-build host=rua v=v2.0.1
```

版本必须来自服务器 `.releases/versions/`，并保留其镜像缓存。回滚恢复完整归档，不支持单侧恢复或数据库 down。

## SSH 正向发布

准备包含完整 Git 历史的服务器 checkout，使它的 HEAD 等于目标提交；保留其中的 Compose 与 nginx 配置。先完成该提交的 CI，并把双侧镜像发布到 GHCR。镜像必须为 linux/amd64，使用构建返回的 digest。

本地候选清单格式如下（值需替换为真实构建结果）：

```json
{
  "version": "v2.0.2",
  "revision": "<完整40位提交SHA>",
  "api_image": "ghcr.io/vod-studio/violet-api@sha256:<64位digest>",
  "web_image": "ghcr.io/vod-studio/violet-web@sha256:<64位digest>"
}
```

```bash
./scripts/deploy-prod.sh --host rua   --manifest /tmp/release-manifest.json   --source-root /root/build/violet
# source-root 是服务器 Git checkout；manifest 是本地文件。
```

SSH wrapper 只传输事务脚本与候选清单，不同步源码、不构建镜像。服务器必须具备 GHCR 拉取权限。它不会自动运行 GitHub CI，操作者负责核对检查结果；事务仍验证候选 SHA 与源码一致、版本顺序、schema 和实际镜像。

运行结束后核对 summary 或 `.releases/current.json`。若存在 `pending.json`，按发布手册核对实际状态后再恢复，不能循环重跑。

## nginx 与静态文件

nginx-proxy 的 Compose 挂载应包含：

```yaml
volumes:
  - ./vhost.d:/etc/nginx/vhost.d
  - ./blog-client:/var/www/blog-client:ro
```

版本化 vhost 配置在 `deploy/nginx/xunrua.top`，由部署事务快照和安装。API 只暴露 9090，Web 只暴露 3000，80/443 由 nginx-proxy 占用；两侧必须加入 proxy 网络。`/api/health` 使用 GET。

事务从候选 Web 镜像提前提取 `dist/client/`，逐文件原子更新共享目录并保留旧 hash 文件。独立 `sync-client.sh` 入口已停用，避免绕过事务清空静态目录。磁盘清理须按保留的发布集合处理，不能直接 prune 归档需要的镜像。

### 服务器级代理组件（OAuth 外呼）

腾讯云国内机直连 `googleapis.com` 被 GFW 掐断，Google 登录会一直超时。
`docker-compose.prod.yml` 给 api 服务注入 `HTTPS_PROXY` 指向宿主机 v2rayA 的
**分流端口 20172**（海外域名走远端节点、B 站等国内域名直连）。

依赖两个服务器级手工组件（不在 compose 内，重装机器需重建）：

```bash
# 1) v2rayA 容器 + v2ray 监听 127.0.0.1:20170-20172（既有部署，略）
# 2) socat 中继:v2ray 只听宿主机 loopback,bridge 容器够不到,
#    经两个 podman 网络网关 IP 中继(host.containers.internal 解析到 10.89.0.1)
cat >/etc/systemd/system/socat-v2ray@.service <<'EOF'
[Unit]
Description=socat relay %i:20172 -> 127.0.0.1:20172 (podman 容器访问宿主机 v2ray 分流代理)
After=network-online.target

[Service]
ExecStart=/usr/bin/socat TCP-LISTEN:20172,bind=%i,fork,reuseaddr TCP:127.0.0.1:20172
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
dnf install -y socat   # 未安装时
systemctl enable --now socat-v2ray@10.89.0.1.service socat-v2ray@10.89.1.1.service
```

验证：`curl -x http://10.89.0.1:20172 https://www.googleapis.com/` 秒回 404 即通。
GitHub（`github.com` / `api.github.com`）国内直连可达，走分流端口同样直连不受影响。


## 代码运行器（可运行代码块沙箱执行）

文章中的可运行代码块（python/node/go/rust/bun）在后端 Docker 沙箱容器执行，stdout/stderr 经 SSE 回传。架构决策见 `docs/adr/0006-code-runner-architecture.md`。

### 前置条件

1. **暴露 podman sock**：api 容器需调宿主 podman daemon 起隔离容器。
   ```bash
   # 启用 podman system service（暴露 sock，持久化需 enable --now）
   ssh rua "sudo systemctl enable --now podman.socket"
   # 验证 sock 可连
   ssh rua "sudo curl -sf --unix-socket /run/podman/podman.sock http://localhost/v4.0.0/libpod/info >/dev/null && echo OK"
   ```
   podman 的 docker-compat sock 通常在 `/run/podman/podman.sock`。

2. **准备 runner 镜像**：字面复用 ygggrasil 项目的 5 个镜像（python/node/go/rust/bun）。
   - 方式 A（跨项目同步）：在 yggdrasil 项目跑 `docker/build-runners.sh` 构建 → `docker save | gzip` → scp → 服务器 `podman load`。
   - 方式 B（服务器原生构建）：把 yggdrasil 的 `docker/` 目录传到服务器，跑 `podman build` 逐个构建。
   ```bash
   # 方式 A 示例
   cd ~/Developer/xfy/yggdrasil
   docker/build-runners.sh
   docker save yggdrasil-runner-python yggdrasil-runner-node yggdrasil-runner-go yggdrasil-runner-rust yggdrasil-runner-bun | gzip > /tmp/runners.tar.gz
   scp /tmp/runners.tar.gz rua:/tmp/
   ssh rua "gunzip -c /tmp/runners.tar.gz | podman load"
   # 验证
   ssh rua "podman images | grep yggdrasil-runner"
   ```

3. **配置环境变量**：在 `.env` 加 `CODE_RUNNER_ENABLED=true` + `DOCKER_SOCKET_PATH=/run/podman/podman.sock`（覆盖默认 `/var/run/docker.sock`）。全套配置项见 `.env.example` 的「代码运行器」段。

4. **挂载 sock**：`docker-compose.prod.yml` 已配 `${DOCKER_SOCKET_PATH:-/var/run/docker.sock}:/var/run/docker.sock`，通过 `DOCKER_SOCKET_PATH` 环境变量控制宿主端路径。

### 启用验证

```bash
# 配置改动通过新的双侧发布生效，随后检查 socket 与 runner 镜像

# api 容器内验证能调 podman daemon
ssh rua "podman exec blog-api ls /var/run/docker.sock"

# 验证 runner 镜像可见（api 通过 podman sock 调宿主 daemon，镜像在宿主层）
ssh rua "podman images | grep yggdrasil-runner"
```

### SSE 长连接注意

代码运行的输出通过 SSE（`GET /api/v1/code-runner/stream`）实时回传。nginx-proxy 默认缓冲响应，需确认：
- handler 已设 `X-Accel-Buffering: no`（关闭 nginx 缓冲）。
- 若 nginx-proxy 仍缓冲，检查 `proxy_buffering off` 或 `proxy_cache off` 配置。

### 安全权衡

挂载 docker.sock = 把宿主 root 权限交给 api 容器。靠以下隔离配置兜底（见 ADR-0006）：
- 执行容器 cap_drop ALL / no-new-privileges / readonly rootfs / network=none
- 内存/CPU/pids 限制（pids_limit=128，防 fork 炸弹）
- 非 root 用户（1000:1000）运行用户代码
