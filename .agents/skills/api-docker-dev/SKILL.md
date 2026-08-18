---
name: api-docker-dev
description: Use when running any Go command or tool in this repo — go test/build/vet, wire, sqlc, golang-migrate, or any make api-* / migrate target. Local Go is unavailable; all of these run inside the dev api container.
---

# Go 命令一律走 dev 容器

本机无 Go 工具链，Makefile 的 api 相关目标（`api-test` / `api-build` / `api-lint` / `migrate` / `wire` 等）在宿主机不可用。把目标定义里的 go 命令原样搬进容器执行（参数以 Makefile 当前定义为准）：

```bash
docker compose -f docker-compose.dev.yml exec -T api go test ./config/...
```

- 在仓库根执行；`-T` 禁用 TTY，输出可直接进管道。
- `./api` 挂载到容器 `/app`，包路径按 `api/` 内相对路径写（`./config/...` 即 `api/config/...`）。
- wire / sqlc 同理；容器内没有对应二进制时向用户报告，不在宿主机安装。

## 前提

dev 容器需在运行。先 `docker compose -f docker-compose.dev.yml ps` 确认；未启动则 `make dev`。
