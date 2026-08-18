---
name: api-toolchain
description: Use when running any Go command or tool — go test/build/vet, wire, sqlc, golang-migrate — in an environment where local Go may be unavailable. Decides the execution path (local vs container) and remembers the user's choice so it is asked only once.
---

# Go 工具链执行决策

按顺序走，停止在第一个命中分支：

1. `go version` 本机可用 → 直接执行，本 skill 到此为止。
2. 本机无 Go，且已有用户决定（会话上下文或长期记忆中有记录）→ **按记录的决定路由，而非按安装状态**：
   - 决定为「安装」→ 安装流程未完成（曾中断）则继续协助安装，装完走 1；仅当用户明确改口才转「拒绝」。
   - 决定为「拒绝」→ 走下方容器方案。
3. 本机无 Go，无决定 → **问用户一次**「是否在本机安装 Go？」
   - 允许 → 协助安装，装完走 1。
   - 拒绝 → 走容器方案。
   - 无论哪个回答，立即用 `learn` 记录决定，后续会话直接命中分支 2，不再重复询问。

## 容器方案（用户决定不装 Go 时）

项目以 compose 起 dev 环境时，go 命令一律进容器执行：

- 定位 compose 文件（`docker-compose*.yml` / `compose.y*ml`）与 api service 名（`docker compose -f <file> config --services`，或 `docker compose ps` 的 Service 列按容器名映射）。
- 形态：`docker compose -f "<file>" exec -T "<svc>" go test ./...`；`-T` 禁用 TTY，输出可直接进管道。占位符替换为实际值时保持引号。
- Makefile 目标在宿主机不可用时，把目标 recipe 里的 go 命令搬进容器执行（参数以 Makefile 当前定义为准）：`$(VAR)` 类 make 变量先在 make 层展开成实际值再搬，不原样粘贴；recipe 里的 `cd api` 类相对路径在容器内已由挂载就位（`./api` → `/app`）。
- codegen / 迁移工具容器内缺失时向用户报告，不在宿主机安装。
- 前提容器在运行：`docker compose ps` 确认；未启动则从 Makefile help 找启动目标——选纯 compose up 的，走本地脚本、依赖本机工具链的目标同样不可用。
