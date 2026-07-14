# PRD: mimo-music Phase 2

> 状态：待实现
> 关联：[Phase 1 PRD](./0005-mimo-music-phase-1.md)、[架构 spec](../adr/mimo-music-architecture.md)
> 范围：生产可用性补全 + 能力扩展

## Problem Statement

Phase 1 搭建了完整的三层架构和 11 个核心端点，但有几处"能跑但不够生产用"的技术债：缓存和 session 用的 noop 实现没接 Redis、Cookie 从响应头提取没做、Prometheus metrics 没埋点、限流熔断没有。这些不补，Phase 1 的代码无法真正部署给博客用。

同时，网易云还有大量常用接口（专辑、歌手、推荐、私人 FM）没接入，博客播放器想要的功能受限。

## Solution

Phase 2 分两步走：

1. **生产可用性补全**：接入 Redis（缓存 + session 真正生效）、Cookie 从 Set-Cookie 提取、Prometheus metrics 埋点、限流熔断装饰器。这些补完后 mimo-music 可部署。
2. **能力扩展**：补充网易云常用接口（专辑详情、歌手信息、每日推荐、私人 FM），让博客播放器功能更完整。

## User Stories

### 生产可用性

1. 作为运维者，我想缓存真正写入 Redis，这样重启服务后缓存不丢。
2. 作为运维者，我想登录态存入 Redis，这样多实例共享 session。
3. 作为博主，我想登录成功后 Cookie 被正确提取存储，这样后续请求能带上登录态。
4. 作为运维者，我想看到 Prometheus 指标（缓存命中率、上游错误率、请求量），这样能监控服务健康。
5. 作为系统，我想在上游限流时自动降级（返回缓存或友好错误），这样不被网易云封 IP。
6. 作为系统，我想对上游调用做熔断（连续失败后短路），这样避免雪崩。

### 能力扩展

7. 作为博客访客，我想获取专辑详情（含歌曲列表），这样能浏览整张专辑。
8. 作为博客访客，我想获取歌手信息和热门歌曲，这样能按歌手找歌。
9. 作为博主，我想获取每日推荐歌曲，这样博客能展示"今日推荐"。
10. 作为博主，我想获取私人 FM 歌曲，这样博客能做"随机播放"。

### 运维

11. 作为运维者，我想 worker 和 server 共享 Redis 连接，这样不用维护两份连接池。
12. 作为运维者，我想 Cookie 轮换支持多账号，这样单个账号被封不影响服务。

## Implementation Decisions

### Redis 接入

- internal/infra/redis/ 建共享 Redis 客户端（cache/store/Asynq 共用）。
- main.go（server + worker）启动时初始化 Redis 连接，注入 cache/redis 和 store/redis。
- 替换 Phase 1 的 NoopCache/NoopSessionStore。

### Cookie 提取

- netease/client.go 的 weapiPost / postJSON 从 HTTP 响应头 Set-Cookie 提取，拼接成完整 Cookie 字符串。
- AuthService.LoginByCellphone / CheckQrcode 的返回值 Cookie 字段改为从响应头提取的真实值。

### Prometheus metrics

- observability/metrics.go 定义指标：request_total / request_duration / cache_hits / cache_misses / upstream_errors / upstream_latency / cookie_health。
- server/middleware 加 metrics 中间件（记录 request_total / request_duration）。
- service 层在缓存命中/未命中、上游调用处埋点。
- GET /metrics 端点暴露 Prometheus 格式。

### 限流熔断装饰器

- provider/decorator.go 实现重试（指数退避）和熔断（连续 N 次失败后短路一段时间）。
- 用装饰器模式包装 provider 实现，不侵入业务代码。
- 熔断状态可观测（metrics + 日志）。

### Cookie 轮换

- store 支持 session 列表 + 轮换策略（round-robin 或最久未用）。
- service 调用解析接口时从 store 取可用 Cookie，失效自动标记跳过。
- worker 健康检查配合标记失效 session。

### 能力扩展（新增端点）

- GET /api/v1/albums/:id — 专辑详情
- GET /api/v1/artists/:id — 歌手信息 + 热门歌曲
- GET /api/v1/recommend/daily — 每日推荐（需登录）
- GET /api/v1/fm — 私人 FM（需登录）

### wire 装配

- 组件增多后引入 wire，server 和 worker 共享 bootstrap provider set。

## Testing Decisions

主 seam 仍在 service 层（mock provider + mock cache）。新增：
- Redis 集成测试（用 miniredis，与 mimo-blog 一致）。
- 装饰器测试（模拟上游失败，验证重试和熔断行为）。
- metrics 测试（验证指标递增）。

## Out of Scope

- SDK 包 pkg/mimomusic — Phase 3
- OTel 跨服务传播 — Phase 3
- mimo-blog 迁移 — Phase 3
- 华为音乐 — Phase X
- 评论、签到、云盘等社交功能 — 视需求

## Further Notes

Phase 2 拆成约 8 个垂直切片，依赖 Phase 1 已有的骨架。优先做 Redis 接入和 Cookie 提取（让 Phase 1 真正可用），再做扩展。
