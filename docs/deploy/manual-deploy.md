# xunrua.top 手动部署指南

记录手动部署 2.0（API + SSR Web）到 `xunrua.top` 的完整流程。该流程独立于 CI（`release-runbook.md` 描述的 rua + GitHub Actions 路径），适用于 runner 不可用或需要紧急手动发布的场景。

## 服务器环境

| 项 | 值 |
|---|---|
| 主机 | `xunrua.top`（root 登录，SSH 已配免密） |
| 架构 | `linux/amd64`（x86_64） |
| 容器运行时 | `podman` + `podman-compose`（**非 docker**） |
| 默认 shell | `fish`（脚本一律用 `bash -lc '...'` 显式调用） |
| 前置反代 | `nginx-proxy` + `letsencrypt-companion` 容器，监听 80/443 |
| 部署目录 | `/root/docker/violet`（含 `api/.env`、`secrets/`、`docker-compose.prod.yml`） |
| 构建目录 | `/root/build/violet`（临时，源码 + podman build，构建完可删） |

### 架构概览

```
Internet ──► nginx-proxy (80/443, TLS)
                │
                ├─ VIRTUAL_HOST=xunrua.top ──► blog-web:3000 (SSR)
                │   （通过 nginx-proxy 自动生成的 server block）
                │
                ├─ /api/ /uploads/ （vhost.d 手动配置）──► blog-api:9090
                │
                └─ /assets/* + 静态扩展名 （vhost.d 手动配置）
                    └─ try_files /var/www/blog-client （nginx 直接服务文件）

blog-web ──SSR 回源──► blog-api:9090 (via blog_network, VITE_SSR_API_BASE_URL)
blog-api ──► blog-postgres:5432, blog-redis:6379 (via blog_network)

# 静态资源产物路径：
# web 容器 build → /app/dist/client/ → podman cp → 宿主机 /root/docker/nginx-proxy/blog-client/
#                                          ↑ nginx-proxy 容器挂载为 /var/www/blog-client:ro
```

`nginx-proxy` 通过 docker-gen 监听容器事件，根据容器的 `VIRTUAL_HOST` / `VIRTUAL_PORT` 环境变量自动生成 `/etc/nginx/conf.d/default.conf`。`/api/` 反代规则在 `/etc/nginx/vhost.d/xunrua.top`（手动维护，nginx-proxy 不会覆盖）。

## 前置条件

1. 本地能 `ssh xunrua.top echo ok`（免密）。
2. 本地装了 `rsync`。
3. 服务器 `/root/docker/violet` 已就绪：含 `api/.env`（敏感凭据，**部署过程绝不覆盖**）。
4. `nginx-proxy` + `letsencrypt-companion` 容器在跑（负责 TLS 证书与反代）。

## 完整部署流程

### 第 1 步：同步源码到服务器构建目录

本地是 Apple Silicon（arm64），`buildx` 跨架构构建（amd64 via QEMU）在本机几乎不可用（卡死）。因此**在服务器原生 amd64 构建**。

```bash
# 在项目根执行
rsync -az --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='uploads' \
  --exclude='tmp' \
  --exclude='bin' \
  --exclude='dist' \
  --exclude='.tanstack' \
  --exclude='.omc' \
  api web xunrua.top:/root/build/violet/
```

排除 `node_modules` / `uploads`（可达数百 MB），服务器上 podman build 会重新装依赖。

### 第 2 步：服务器上构建镜像

用 `nohup` + 日志文件构建，避免 SSH 超时断开杀掉进程。**必须用 `bash -lc`**（服务器默认 fish）。

```bash
# 构建 API 镜像
ssh xunrua.top "bash -lc 'cd /root/build/violet && \
  rm -f /tmp/build-api.log && \
  nohup bash -c \"podman build -t localhost/violet-api:latest -f api/Dockerfile api > /tmp/build-api.log 2>&1; echo BUILD_API_EXIT=\$? >> /tmp/build-api.log\" >/dev/null 2>&1 & disown'"

# 构建 Web 镜像
ssh xunrua.top "bash -lc 'cd /root/build/violet && \
  rm -f /tmp/build-web.log && \
  nohup bash -c \"podman build -t localhost/violet-web:latest -f web/Dockerfile web > /tmp/build-web.log 2>&1; echo BUILD_WEB_EXIT=\$? >> /tmp/build-web.log\" >/dev/null 2>&1 & disown'"
```

轮询日志直到 `BUILD_*_EXIT=0`：

```bash
ssh xunrua.top "grep BUILD_API_EXIT /tmp/build-api.log; tail -3 /tmp/build-api.log"
ssh xunrua.top "grep BUILD_WEB_EXIT /tmp/build-web.log; tail -3 /tmp/build-web.log"
```

构建要点：
- `api/Dockerfile` 已设 `GOPROXY=https://goproxy.cn,direct`，国内服务器下载 Go modules 不超时。
- `web/Dockerfile` 多阶段：deps（pnpm install）→ builder（vite build + prune 生产依赖）→ runtime。
- `web/server.mjs` 是 SSR 启动器（详见下方「关键设计」），runtime 入口为 `node server.mjs`。

### 第 3 步：准备部署用 compose 文件

服务器 `/root/docker/violet` 没有 `api/`、`web/` 源码（只有 `api/.env` 和 `secrets/`），所以 compose 必须用 `image:` 引用已构建的镜像，**不能用 `build:`**。

生成 `/root/docker/violet/docker-compose.prod.yml`（关键片段）：

```yaml
services:
  # postgres / redis: 同本地 docker-compose.prod.yml，省略

  api:
    image: localhost/violet-api:latest   # ← 用 image，不是 build
    container_name: blog-api
    expose: ["9090"]                         # ← 2.0 端口是 9090（旧版 8080）
    env_file: [./api/.env]
    environment:
      DATABASE_HOST: postgres
      # ...其余同本地
    volumes:
      - uploads_data:/app/uploads
    healthcheck:
      # ← 必须用 GET，/api/health 不接受 HEAD（旧版用 HEAD 返回 405 导致一直 unhealthy）
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--method=GET", "-O-", "http://localhost:9090/api/health"]
    networks: [backend, proxy]               # ← 必须同时在 proxy 网络，nginx-proxy 才能转发

  web:
    image: localhost/violet-web:latest
    container_name: blog-web
    expose: ["3000"]                         # ← 不用 ports，避免和 nginx-proxy 抢 80
    environment:
      VIRTUAL_HOST: xunrua.top
      VIRTUAL_PORT: "3000"                   # ← 告诉 nginx-proxy 转发到 3000
      LETSENCRYPT_HOST: xunrua.top
      LETSENCRYPT_EMAIL: defect.y@qq.com
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/"]
    networks: [backend, proxy]
```

完整文件见仓库 `docker-compose.prod.yml`（构建参数版）—— 部署时把 `build:` 段整体替换为 `image:`。

### 第 4 步：备份旧 compose 并上传新的

```bash
# 备份（回滚用）
ssh xunrua.top "cp /root/docker/violet/docker-compose.prod.yml \
  /root/docker/violet/docker-compose.prod.yml.bak-$(date +%Y%m%d-%H%M%S)"

# 上传（本地把 image 版 compose 放到 /tmp 再 scp）
scp /tmp/deploy-compose.yml xunrua.top:/root/docker/violet/docker-compose.prod.yml
```

### 第 5 步：重启服务（保留 secrets / 数据卷）

```bash
ssh xunrua.top "bash -lc 'cd /root/docker/violet && \
  podman-compose --env-file api/.env -f docker-compose.prod.yml down && \
  podman-compose --env-file api/.env -f docker-compose.prod.yml up -d'"
```

`down` 只删容器，命名卷 `blog_postgres_data` / `blog_redis_data` / `blog_uploads_data` 保留，数据不丢。

**重要**：如果只改了 web，重建 web 容器即可（避免 API 短暂中断）。但 `podman-compose up -d web` 若容器已存在会**复用旧容器**，必须先 `podman rm -f blog-web`：

```bash
ssh xunrua.top "bash -lc 'cd /root/docker/violet && \
  podman rm -f blog-web && \
  podman-compose --env-file api/.env -f docker-compose.prod.yml up -d web'"
```

### 第 6 步：确认 nginx 反代

`nginx-proxy` 会根据 `blog-web` 的 `VIRTUAL_HOST` 自动生成 `xunrua.top` 的 server block。但 **`/api/` 反代需要手动维护** `/etc/nginx/vhost.d/xunrua.top`（在 nginx-proxy 容器内）：

```bash
ssh xunrua.top "podman exec nginx-proxy cat /etc/nginx/vhost.d/xunrua.top"
```

内容应为（**端口必须是 9090**）：

```nginx
location ^~ /api/ {
    proxy_pass http://blog-api:9090;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

若端口是旧的 8080，改并 reload：

```bash
ssh xunrua.top "bash -lc '\
  podman exec nginx-proxy sed -i s/blog-api:8080/blog-api:9090/g /etc/nginx/vhost.d/xunrua.top && \
  podman exec nginx-proxy nginx -t && \
  podman exec nginx-proxy nginx -s reload'"
```

若 `blog-api` 不在 `nginx-proxy` 网络（nginx-proxy 转发失败 502），手动接入：

```bash
ssh xunrua.top "podman network connect nginx-proxy blog-api"
```

（compose 里 `networks: [backend, proxy]` + `proxy: external: true` 应自动处理，但 podman-compose 偶发不接入时需手动。）

### 第 7 步：验证

```bash
# 容器状态（4 个都应 healthy）
ssh xunrua.top "podman ps --format '{{.Names}}\t{{.Status}}' | grep blog"

# 外部访问
curl -sk -o /dev/null -w "web:%{http_code}\n" https://xunrua.top/
curl -sk -o /dev/null -w "css:%{http_code}\n" https://xunrua.top/assets/styles-<hash>.css
curl -sk https://xunrua.top/api/v1/announcements   # 应返回 {"data":[...]}
curl -sk -o /dev/null -w "health:%{http_code}\n" https://xunrua.top/api/health
```

## 关键设计：为什么 web 需要 server.mjs

TanStack Start 1.168 的 `vite build` 产出 `dist/server/server.js`，它只导出 H3 风格的 `{ fetch }` handler，**不调用 `listen()` 监听端口**。直接 `node dist/server/server.js` 会加载完模块立即退出（exit 0）。

`web/server.mjs` 是一层薄的 `node:http` wrapper：
- 用 `node:http` 创建 HTTP server 监听 `PORT`（默认 3000）
- 每个请求转成 Web `Request` 交给 `dist/server/server.js` 的 `fetch`
- 同时服务 `dist/client/` 下的静态资源（带 hash 的永久缓存，其他 no-cache）
- 优雅处理 SIGTERM/SIGINT

这是 TanStack Start「ditching adapters」理念下的标准做法：框架不绑定 HTTP server，由部署方提供最薄的 node:http 桥接。

## 常见坑

### 1. 端口 80 冲突
web 容器若用 `ports: ["80:3000"]`，会和 `nginx-proxy`（已占 80）冲突，启动报 `bind: address already in use`。**web 只能用 `expose: ["3000"]`**，让 nginx-proxy 转发。

### 2. healthcheck 用 HEAD 导致 API 一直 unhealthy
`/api/health` 路由只注册了 GET。旧 compose 用 `wget --spider`（发 HEAD）返回 405，API 永远 unhealthy，web 因 `depends_on: api healthy` 起不来。**healthcheck 必须显式 `--method=GET`**。

### 3. blog-api 不在 nginx-proxy 网络
若 `nginx-proxy` 转发 `/api/` 报 502，检查 `blog-api` 是否同时在 `blog_network` 和 `nginx-proxy` 两个网络。podman-compose 的 external 网络偶尔不自动接入，用 `podman network connect nginx-proxy blog-api` 手动补。

### 4. podman-compose up 不重建已存在容器
改了镜像后 `podman-compose up -d web` 若 `blog-web` 容器已存在，会复用旧容器（跑旧镜像）。**必须先 `podman rm -f blog-web`** 再 up，或用 `podman-compose up -d --force-recreate web`。

### 5. SSH 连接中断
服务器构建慢（pnpm install + vite build 约 1-2 分钟），SSH 超时会杀进程。**一律用 `nohup ... & disown` + 日志文件**，然后轮询日志。

### 6. podman 镜像短名匹配到错误的 arm64 localhost 镜像
compose 里 `image: postgres:16-alpine` 写短名时，podman 会优先匹配 `localhost/postgres:16-alpine`（可能由 buildx 或其他操作残留的 arm64 镜像），在 amd64 服务器上报 `Exec format error`，容器疯狂重启。**postgres/redis 必须用全限定名** `docker.io/library/postgres:16-alpine`，且定期清理 `podman image prune` 防止污染。

排查：`podman image inspect <image> --format "{{.Architecture}}"` 看架构；删除错误镜像 `podman rmi -f localhost/postgres:16-alpine`。

### 7. 国内服务器 apk 下载极慢
alpine 官方源 `dl-cdn.alpinelinux.org` 在国内服务器下载 ffmpeg 等 C 库（113 个包）可能耗时超过 10 分钟甚至超时。**Dockerfile runtime 阶段 `apk add` 前换阿里云源**：
```dockerfile
RUN sed -i 's#dl-cdn.alpinelinux.org#mirrors.aliyun.com#g' /etc/apk/repositories
RUN apk add --no-cache ca-certificates wget ffmpeg
```
（api/Dockerfile 已内置此修改。Go module 下载同理，已设 `GOPROXY=https://goproxy.cn,direct`。）

### 8. 静态资源（/assets/*）404 —— nginx 与 web 容器职责边界
TanStack Start 的 `dist/server/server.js` **不服务静态资源**（只导出 SSR fetch handler）。若 nginx 也没有静态文件访问权，`/assets/*.css|js` 会两边都没人服务，全 404，页面白屏。

**解法**：让 nginx-proxy 直接服务静态资源（见下方「静态资源部署」章节）。web 容器 `dist/client/` 通过宿主机共享目录暴露给 nginx-proxy，nginx 在 vhost.d 加 `location ~* \.(css|js|...)$` 直接 `try_files`。

## 静态资源部署（nginx 直接服务）

web 构建产物 `dist/client/`（含 `assets/`、favicon、pdf.worker 等）由 nginx 直接服务，不走 SSR。一次性配置 + 每次部署同步产物。

### 一次性配置（nginx-proxy 加挂载）

nginx-proxy 是 compose 管理（`/root/docker/nginx-proxy/docker-compose.yml`），加挂载后重建：

```bash
# 创建共享目录
ssh xunrua.top 'mkdir -p /root/docker/nginx-proxy/blog-client'

# 给 nginx-proxy compose 的 volumes 加一行（备份后 sed 插入）
ssh xunrua.top 'cd /root/docker/nginx-proxy && cp docker-compose.yml docker-compose.yml.bak && \
  sed -i "/\.\/html:\/usr\/share\/nginx\/html/a\\      - ./blog-client:/var/www/blog-client:ro" docker-compose.yml && \
  podman-compose up -d'   # 重建 nginx-proxy 容器应用新挂载
```

### vhost.d 加静态资源 location（幂等）

追加到 `/root/docker/nginx-proxy/vhost.d/xunrua.top`：

```nginx
# 静态资源由 nginx 直接服务，不走 SSR
# 扩展名列表必须覆盖 web 产物里所有根目录文件类型，否则会落回 SSR 返回 HTML 兜底（404）
location ~* \.(css|js|mjs|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|wasm|map|json|txt|xml|webmanifest)$ {
    root /var/www/blog-client;
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
```

reload：`ssh xunrua.top 'podman exec nginx-proxy nginx -t && podman exec nginx-proxy nginx -s reload'`

### 每次部署 web 后同步产物

**web 容器重建后必须执行**，否则 nginx 服务的还是旧版本（hash 不匹配 → 404）。

已封装为脚本，在项目根执行：

```bash
./scripts/sync-client.sh                  # 默认远程 xunrua.top
./scripts/sync-client.sh --host <其他host> # 指定其他 SSH host
```

脚本做的事：清空共享目录 → `podman cp blog-web:/app/dist/client/.` → 共享目录。

## 代码运行器（可运行代码块沙箱执行）

文章中的可运行代码块（python/node/go/rust/bun）在后端 Docker 沙箱容器执行，stdout/stderr 经 SSE 回传。架构决策见 `docs/adr/0006-code-runner-architecture.md`。

### 前置条件

1. **暴露 podman sock**：api 容器需调宿主 podman daemon 起隔离容器。
   ```bash
   # 启用 podman system service（暴露 sock，持久化需 enable --now）
   ssh xunrua.top "sudo systemctl enable --now podman.socket"
   # 验证 sock 可连
   ssh xunrua.top "sudo curl -sf --unix-socket /run/podman/podman.sock http://localhost/v4.0.0/libpod/info >/dev/null && echo OK"
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
   scp /tmp/runners.tar.gz xunrua.top:/tmp/
   ssh xunrua.top "gunzip -c /tmp/runners.tar.gz | podman load"
   # 验证
   ssh xunrua.top "podman images | grep yggdrasil-runner"
   ```

3. **配置环境变量**：在 `api/.env` 加 `CODE_RUNNER_ENABLED=true` + `DOCKER_SOCKET_PATH=/run/podman/podman.sock`（覆盖默认 `/var/run/docker.sock`）。全套配置项见 `.env.example` 的「代码运行器」段。

4. **挂载 sock**：`docker-compose.prod.yml` 已配 `${DOCKER_SOCKET_PATH:-/var/run/docker.sock}:/var/run/docker.sock`，通过 `DOCKER_SOCKET_PATH` 环境变量控制宿主端路径。

### 启用验证

```bash
# 重启 api 容器加载新配置
ssh xunrua.top "cd /root/docker/violet && podman-compose --env-file api/.env -f docker-compose.prod.yml up -d --force-recreate api"

# api 容器内验证能调 podman daemon
ssh xunrua.top "podman exec blog-api ls /var/run/docker.sock"

# 验证 runner 镜像可见（api 通过 podman sock 调宿主 daemon，镜像在宿主层）
ssh xunrua.top "podman images | grep yggdrasil-runner"
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

## 回滚

### 镜像级回滚（podman 保留了旧镜像层）
```bash
# 查看历史镜像
ssh xunrua.top "podman images localhost/violet-api"
# 旧镜像若还在，retag 后重启
ssh xunrua.top "bash -lc 'podman tag <旧image-id> localhost/violet-api:latest && \
  cd /root/docker/violet && podman-compose --env-file api/.env -f docker-compose.prod.yml up -d --force-recreate api'"
```

### compose 回滚
```bash
ssh xunrua.top "cp /root/docker/violet/docker-compose.prod.yml.bak-YYYYMMDD-HHMMSS \
  /root/docker/violet/docker-compose.prod.yml && \
  cd /root/docker/violet && podman-compose --env-file api/.env -f docker-compose.prod.yml up -d --force-recreate"
```

### 数据库回滚
若新版本含破坏性迁移，回滚前在服务器手动降版本 schema：
```bash
ssh xunrua.top "podman exec blog-api /migrate version"       # 查看当前版本
ssh xunrua.top "podman exec blog-api /migrate down -n 1"     # 回滚一次迁移
```

## 临时占位容器（web 故障时保住 API）

web 容器跑不起来时，nginx-proxy 不会生成 `xunrua.top` 的 server block（没有健康容器可转发），导致**整个站（含 API）502**。这时起一个占位容器顶住 nginx 配置：

```bash
ssh xunrua.top "podman run -d --name blog-web-placeholder --network nginx-proxy \
  -e VIRTUAL_HOST=xunrua.top -e VIRTUAL_PORT=80 \
  -e LETSENCRYPT_HOST=xunrua.top -e LETSENCRYPT_EMAIL=defect.y@qq.com \
  docker.io/library/nginx:alpine"
```

placeholder 让 nginx-proxy 生成 xunrua.top 配置，`/api/` 反代照常工作（vhost.d 规则不依赖 web）。web 修好后 `podman rm -f blog-web-placeholder` 再起真 blog-web。

## 清理

```bash
# 删除构建目录（镜像已 tag，源码不再需要）
ssh xunrua.top "rm -rf /root/build/violet"

# 删除旧 image tar 包（若用 rsync + 服务器构建，不再有 images.tar.gz）
ssh xunrua.top "rm -f /root/docker/violet/images.tar.gz /root/docker/violet/*.tar.gz"

# podman 清理未使用的镜像层（释放空间）
ssh xunrua.top "podman image prune -f"
```
