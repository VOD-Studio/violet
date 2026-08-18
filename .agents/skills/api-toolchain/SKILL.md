---
name: api-toolchain
description: Use when running any Go command or tool in this repo — go test/build/vet, wire, sqlc, golang-migrate, or any make api-* / migrate target. Decides the execution path (local Go vs dev container) and remembers the user's choice so it is asked only once.
---

# 后端 Go 命令执行决策

按顺序走，停止在第一个命中分支：

1. `go version` 本机可用 → 直接执行，`make api-*` 目标均可用，本 skill 到此为止。
2. 本机无 Go，且已有用户决定（会话上下文或长期记忆中有记录）→ 按决定走：装了 Go 走 1，不装走下方容器方案。
3. 本机无 Go，无决定 → **问用户一次**「是否在本机安装 Go？」
   - 允许 → 协助安装（fnm/brew 等），装完走 1。
   - 拒绝 → 走容器方案。
   - 无论哪个回答，立即用 `learn` 记录决定（如「violet 仓库用户拒绝本机安装 Go，后端命令一律容器执行」），后续会话直接命中分支 2，不再重复询问。

## 容器方案（用户决定不装 Go 时）

Makefile 的 api 相关目标（`api-test` / `api-build` / `api-lint` / `migrate` / `wire` 等）在宿主机不可用。把目标定义里的 go 命令原样搬进容器执行（参数以 Makefile 当前定义为准）：

```bash
docker compose -f docker-compose.dev.yml exec -T api go test ./config/...
```

- 在仓库根执行；`-T` 禁用 TTY，输出可直接进管道。
- `./api` 挂载到容器 `/app`，包路径按 `api/` 内相对路径写（`./config/...` 即 `api/config/...`）。
- wire / sqlc 同理；容器内没有对应二进制时向用户报告。

前提：dev 容器在运行。先 `docker compose -f docker-compose.dev.yml ps` 确认；未启动则 `make docker-dev`（`make dev` 走本地 `dev.sh`，依赖本机 Go，不可用）。
