# T1 [linkpreview] 独立模块：抓取、缓存与 lookup 端点

前置：无（本组首张，PRD `docs/prd/0038-推文媒体与链接展示.md`）。

## 目标

新增独立 `linkpreview` 后端模块：按 URL 去重的 OG 卡片缓存，TTL 惰性重抓，通用批量取卡片端点。不依赖 tweet 模块，tweet 是后续消费方。

## 改动点

- `api/internal/domain/linkpreview/`：LinkCard 聚合（url 唯一、title/description/site_name、image_file_id、status ok/failed/pending、fetched_at/expires_at、last_error/fail_count）+ 仓储契约。
- 抓取设施（`api/internal/infrastructure/` 下新增，与 xtweet 平级）：HTML 抓取（复用 `ssrf.NewSafeTransport`，仅 http/https，超时 6s、上限 2MiB、仅 text/html、重定向 ≤5 次逐跳复检）；OG/Twitter meta 解析（`og:title/description/site_name/image` + `twitter:*` 回退 + `<title>` 兜底）；封面下载落 uploads（purpose=`link-preview`，10MiB/2 千万像素，复用图片处理器）。
- 应用服务：`Lookup(ctx, urls)`——命中未过期返回快照；miss/过期/退避已过返回现有结果并异步抓取（单飞合并同 URL，进程并发 4）；失败退避 24h，保留旧快照。
- migration `143_link_cards.up/down.sql`。
- `POST /api/v1/link-cards/lookup`（≤10 URL）+ OpenAPI 契约 + handler。
- 装配：`app/linkpreview_container.go`、`container.go` 挂载、`routing/` 注册。
- 字段注释按 AGENTS 领域实体规范（每个命名字段一行）。

## 验收

- 领域单测：TTL 过期判定、退避期内不重抓、fail_count 递增、旧快照保留。
- 集成测试（隔离 PG）：同 URL 二次 lookup 不重复抓取（HTTP 计数夹具）；并发 lookup 单飞。
- SSRF 用例：`127.0.0.1`、`169.254.169.254`、非法端口被拒且记 failed。
- 抓取夹具（本地 httptest）：完整 OG、仅 twitter:* 回退、无 meta 兜底、非 HTML、超时、封面相对路径解析。
- `make api-test`、`api-lint` 容器路径全绿。
