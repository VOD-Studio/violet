---
name: api-docker-dev
description: Use when running any Go toolchain command in this repo — go test/build/vet, wire, sqlc, golang-migrate. Local Go is unavailable; run these inside the dev api container instead of the make api-* targets.
---

# Go 命令一律走 dev 容器

本机无 Go 工具链，Makefile 的 api 相关目标（`api-test` / `api-build` / `api-lint` / `migrate` / `wire` 等）在宿主机不可用。统一用容器形式：

```bash
docker compose -f docker-compose.dev.yml exec -T api go test ./config/...
```

- 在仓库根执行；`-T` 禁用 TTY，输出可直接进管道。
- `./api` 挂载到容器 `/app`，`go.mod` 位于 `/app/go.mod`；包路径按 `api/` 内相对路径写（`./config/...` 即 `api/config/...`）。

## Makefile 目标对照

| Makefile 目标 | 容器内形式 |
|---|---|
| `make api-test` | `… exec -T api go test ./...` |
| `make api-build` | `… exec -T api go build ./cmd/server` |
| `make api-lint` | `… exec -T api golangci-lint run`（容器内无此二进制时用 `go vet ./...`） |
| `make migrate` | `… exec -T api go run ./cmd/migrate up` |

wire / sqlc 同理走 exec；容器内没有对应二进制时向用户报告，不在宿主机安装。

## 前提

dev 容器需在运行。先 `docker compose -f docker-compose.dev.yml ps` 确认；未启动则 `make dev-docker`。

## 完成判据

命令在容器内执行且退出码为 0；非零退出时完整呈现错误输出再处理。
