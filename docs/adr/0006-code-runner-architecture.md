# 可运行代码块执行架构
Status: accepted（2026-07-23）

## 背景

要把 yggdrasil 项目（Rust + Dioxus）的「文章/编辑器可运行代码块」功能复刻到 mimo-blog（Go + Chi + React）。yggdrasil 用 bollard（Rust Docker SDK）直连 unix socket，在隔离容器里执行用户代码，通过 SSE 流式回传 stdout/stderr 到 xterm.js 终端。

跨技术栈复刻时，若干决策无法 1:1 平移，必须重新选定：

1. **执行引擎**：yggdrasil 用 bollard 走 socket。mimo-blog 生产环境是 podman（非 docker），需确认 socket 路径可行性。
2. **runner 镜像**：yggdrasil 自建 `yggdrasil-runner-{python,node,go,rust,bun}` 五个镜像。
3. **任务状态存储**：yggdrasil 用进程内 DashMap。mimo-blog 部署形态不同（生产多副本可能）需重新评估。
4. **阅读页代码区**：是否可编辑、是否带 Vim。

## 决策

1. **执行引擎用 Docker Go SDK + unix socket**（对应 bollard）。socket 路径可配（`DOCKER_SOCKET_PATH`，默认 `/var/run/docker.sock`），兼容 docker 与 podman。yggdrasil 的 `docker.rs:64` 注释已证明 socket 路径同时被 docker 与 podman 接受（tmpfs 用 `mode=1777` 而非 docker 专有的 `uid=1000` 扩展选项，podman 报 unknown mount option）。生产 podman 通过其 docker-compat sock 或原生 sock 暴露给 api 容器。
2. **runner 镜像字面复用 `yggdrasil-runner-*`**（python/node/go/rust/bun 五个），跨项目共享已构建产物，不在 mimo-blog 重建。镜像需在部署前 `docker load` / `podman load` 到目标宿主。
3. **任务状态存 Redis，SSE channel 留进程内**。任务进度复用 `refetch_status_store.go` 的 Redis 范式（key 形如 `code_runner:task:<id>`），多副本部署时状态可共享。SSE 的 mpsc channel 仍是进程内 `sync.Map`（对应 yggdrasil 的 `EXEC_STREAMS`），因为流式输出必须连到执行实例——单实例下无影响，多实例需配合粘性路由（标注为后续扩展点）。
4. **阅读页代码区用 CodeMirror 可编辑 + Vim 模式**，与 ygggrasil 完全一致。Vim 由 `@replit/codemirror-vim` 提供，用 CodeMirror `Compartment.reconfigure` 热切换（不重建实例，保留 Vim 状态/光标/撤销栈），偏好持久化到 localStorage（key `mimo-code-runner-vim`，默认开启）。

## 不变的复刻契约（1:1 照搬 ygggrasil）

- 5 语言 + 别名归一（js→node、ts→bun、rs→rust）。
- 围栏 info string 格式 `<lang> runnable {<ResourceLimits JSON>}`。
- 资源钳制 `clampLimits`：作者 overrides 钳到全局 `CODE_RUNNER_MAX_*` 上限内。
- 沙箱隔离：cap_drop ALL / no-new-privileges / readonly rootfs / tmpfs（/code `mode=1777`、/tmp `mode=1777,exec`、/run）/ network=none / memory=swap / pids_limit=128 / nofile=64。不设 nproc（non-root 下 setrlimit 按 UID 计数会导致初始 exec EAGAIN）。pids_limit 从 ygggrasil 的 64 提到 128：go 编译 fork 大量 compile/asm 子进程，64 会被 cgroup 拒绝（fork/exec EAGAIN）。
- 两条执行路径：编辑器内走轮询 `GetExecResult`；阅读页走 SSE 流式 `StartExecStream` + `/api/v1/code-runner/run/stream`。
- 并发信号量 + 排队超时 `queue_timeout_secs`。
- 错误脱敏：匿名可见「不支持的语言/超限/限流」；系统内部异常一律「系统暂时不可用」。
- admin 跳过速率限制（便于作者沙箱调试），仍受并发槽、资源钳制、源码大小约束。
- 默认 ResourceLimits：python/node/bun 256MB/5s；go 384MB/10s；rust 512MB/15s；均 cpu 1.0、output 1MB、无网络。go 内存从 ygggrasil 的 256MB 提到 384MB：编译 fork 大量子进程，256MB 会 OOM。
- 容器清理：Go 用 `defer` + 重试 + 兜底日志（对应 yggdrasil 的 `ContainerGuard`），防泄漏。

## 理由

- **Docker Go SDK 是 bollard 的 Go 对等物**，API 覆盖完整（容器生命周期、attach、日志、资源限制），能精确表达 ygggrasil 的全部隔离配置。os/exec 拼 CLI 参数方案会把这些安全配置退化成一长串字符串，易错且难维护。
- **镜像字面复用**省掉重建 5 个语言镜像的成本，且 ygggrasil 镜像已验证 podman 兼容。代价是 mimo-blog 部署流程依赖 ygggrasil 的镜像构建产物。
- **Redis 存任务状态**是平衡可行性与扩展性的选择：进程内 map 最简但多副本不共享；数据库表最重且 SSE 仍需 channel 配合。Redis 既有基础设施（限流、session、任务状态范式都已在用），多副本时状态可共享，是中间路线。
- **CodeMirror + Vim 热切换**是 ygggrasil 已验证的方案，Compartment.reconfigure 保证切换 Vim 不丢编辑上下文，体验完整。

## 代价

- api 容器需挂载 docker.sock（生产指向 podman sock），等于把宿主 root 权限交给 api 容器——公认安全风险，靠严格 ResourceLimits + 非 root 运行 + 网络隔离 + 只读 rootfs 兜底。
- SSE 是项目首次引入，需验证 nginx-proxy 对长连接的支持。
- 跨项目镜像依赖：ygggrasil 镜像构建变更需同步到 mimo-blog 部署。
- 多副本部署时 SSE 必须粘到执行实例（一致性哈希或粘性路由），本期不解决，标注为后续扩展点。

## 已否决

- **os/exec 调 docker/podman CLI**：不引入重型 SDK 依赖、与项目现有 ffmpeg exec 范式一致，但安全配置退化为 CLI 字符串拼接，代码结构与 ygggrasil 差异大，维护成本高。
- **直接 exec 无容器**：进程级资源限制（cgroups/prlimit）安全性远不如容器隔离，不适合跑用户提交的代码。
- **任务状态全内存（同 ygggrasil）**：最简单，但 api 多副本时任务状态不共享、SSE 必须粘到执行实例，扩展性差。
- **任务状态落数据库表**：最重，可审计可回放，但 SSE 仍需内存 channel 配合，本期无执行历史审计需求，YAGNI。
- **阅读页代码区只读（shiki 高亮 + 运行按钮）**：更轻、零新依赖，但牺牲原地编辑运行的交互，与「完整复刻」要求不符。
