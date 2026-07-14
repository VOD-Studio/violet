# mimo-music

多平台音乐能力服务，用 Go 实现。

当前状态：Phase 1 已完成（骨架 + 登录 + 核心解析 + worker + observability），Phase 2 待实现（Redis 接入 + 指标 + 扩展接口）。

## 运行

```bash
# 直接运行
go run ./cmd/server

# 热重载开发
air

# Docker
docker compose up mimo-music
```

默认监听 `:8080`，环境变量 `MIMO_MUSIC_SERVER_PORT` 可覆盖。

## 验证

```bash
curl localhost:8080/health
# {"code":0,"data":{"status":"ok"},"message":""}
```

## 架构

详见 [架构设计文档](../docs/adr/mimo-music-architecture.md)。

## 开发

```bash
go build ./cmd/server/    # 编译
go test ./...             # 测试
go vet ./...              # 检查
```

## 技术栈

- Go 1.25 + chi 路由
- slog 结构化日志（后续 issue 接入完整可观测性）
- 网易云 weapi/eapi 加密自实现（Go 标准库，不依赖第三方音乐库）
