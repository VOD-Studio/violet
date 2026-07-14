# Issue-0008：Cookie 健康检查 worker

## Parent

PRD：`../../prd/0005-mimo-music-phase-1.md`（user story 6）

## What to build

独立 worker 进程（cmd/worker/main.go），用 Asynq 定时检查 SessionStore 里的 Cookie 是否有效。每 6 小时执行一次：取 Cookie → 调 provider LoginStatus → 失效则记 Warn 日志 + Prometheus 指标。

worker 和 server 共享 internal/bootstrap/ 的 wire 装配，各自只取需要的组件子集。worker 独立进程，重启不影响 HTTP 服务。

## Acceptance criteria

- [ ] `mimo-music/cmd/worker/main.go`：worker 进程入口，启动 Asynq server
- [ ] `mimo-music/internal/worker/tasks/cookie_health.go`：Cookie 健康检查任务
  - 从 store 取所有 session
  - 逐个调 provider LoginStatus 验证
  - 失效的记 Warn 日志（含 user_id hash）+ Prometheus counter
- [ ] `mimo-music/internal/worker/scheduler.go`：注册定时任务（每 6 小时）
- [ ] `mimo-music/internal/bootstrap/wire.go`：wire provider set，server 和 worker 共享
- [ ] `mimo-music/internal/bootstrap/wire_gen.go`：wire 生成
- [ ] `make wire` 在 mimo-music 目录可用
- [ ] worker 日志带 task_id / duration_ms / 成功失败
- [ ] 高频场景日志降级 Debug 或采样（依赖 Issue-0002 的 sampling handler）
- [ ] docker-compose 中 worker 作为独立 service（和 server 共享镜像，不同 command）
- [ ] worker 集成测试（mock provider + mock store）：
  - Cookie 有效时不告警
  - Cookie 失效时记 Warn + 指标递增
- [ ] 所有导出符号有 godoc 注释

## Blocked by

- Issue-0002（observability，日志 + metrics）
- Issue-0006（登录能力，provider LoginStatus + store）
