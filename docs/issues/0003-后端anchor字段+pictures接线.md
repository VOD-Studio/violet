# Issue-0003：后端 anchor 字段 + pictures 接线

## Parent

PRD-0001（`docs/prd/0001-锚点批注评论.md`）

## What to build

为评论表新增 anchor 五元组字段（nullable，仅顶级评论非空），并把当前半成品的 pictures 字段从 handler 接通到 service/domain。这是 Slice 5（正文批注）和 Slice 6（划线创建）的硬前置——**prefactor issue，本身不产生用户可见功能**，但端到端可验证（API 能收能存能返 anchor）。

端到端行为（API 层验证）：
- `POST /comments` 接受可选 `anchor: { block_id, start_offset, end_offset, selected_text, block_text_hash }`；仅顶级评论（无 `parent_id`）可带 anchor，带 `parent_id` 的回复传 anchor 报错。**批注强制登录**：带 anchor 时会话必须有 user_id（Issue-0001 已在 handler 层实现登录校验，本 issue 不重复实现，但 service 层加防御性校验：`Anchor != nil && UserID == nil` → 报错）。
- `POST /comments` 接受可选 `pictures: CommentPicture[]`（接通现有半成品字段）。pictures 匿名/登录都可附。
- `GET /posts/{postId}/comments` 的 DTO 返回 anchor（可为 null）和 pictures。
- anchor 五元组校验：`block_id` 非空、`start_offset >= 0`、`end_offset > start_offset`、`selected_text` 非空、`block_text_hash` 非空。

## Acceptance criteria

- [ ] 新增 migration（`api/migrations/NNN_add_comment_anchor.up/down.sql`）：`comments` 表加 5 列 `anchor_block_id VARCHAR(16)` / `anchor_start_offset INTEGER` / `anchor_end_offset INTEGER` / `anchor_selected_text TEXT` / `anchor_block_text_hash VARCHAR(16)`，全部 nullable；**加 CHECK 约束** `(anchor_block_id IS NULL OR created_by IS NOT NULL)`（强制批注登录，DB 层兜底防绕过）。
- [ ] 注：`created_by` 列本身在 Issue-0001 已加（nullable，登录非空、匿名 nil）。本 issue 假设该列已就位；若 Issue-0001 未先完成，需先把 `created_by` 列加上。
- [ ] GORM 模型（`infrastructure/persistence/gorm/model/content.go` 的 Comment）同步新增 5 列映射 + pictures 映射。
- [ ] `domain/comment/entity.go`：新增 `Anchor` 值对象（5 字段 + 校验方法）；`Comment` 聚合持有 `*Anchor`（nil 表示自由评论）；`NewComment` 接受可选 `Anchor`，**关键校验**：`Anchor != nil && UserID == nil` → 报错（批注强制登录，与 Issue-0001 的 handler 层校验形成纵深防御）；回复（有 parent）传 Anchor 报错。
- [ ] `application/comment/service.go`：`CreateInput` 新增 `Anchor *Anchor` + `Pictures []Picture`；校验「有 parent_id 时 Anchor 必须为 nil」。
- [ ] handler `Create`：解析请求体的 `anchor` 和 `pictures` 字段，透传 service。
- [ ] `CommentDTO` 新增 `anchor`（nullable）和 `pictures` 字段序列化。
- [ ] pictures 接线：handler 当前未解析 pictures（半成品），本期接通——请求体 `pictures` → service → domain → repo。
- [ ] 仓储层 `comment_repo.go` 读写 anchor 列 + pictures 列。
- [ ] 测试：
  - domain `Anchor` 值对象校验（block_id 非空、offset 合法性、selected_text 非空）。
  - domain **批注强制登录**：`Anchor != nil && UserID == nil` → 报错；`Anchor == nil && UserID == nil`（匿名自由评论）合法。
  - service 层「回复带 anchor 报错」用例。
  - 仓储层（SQLite + `setupCommentTestDB` AutoMigrate 新模型）读写 anchor + pictures。
  - handler 测试（Issue-0001 建立的 seam）：anchor 五元组缺字段 → 400；anchor 完整 → 201 且 DTO 回显。
- [ ] OpenAPI 同步 anchor + pictures schema。
- [ ] 可选：`comment_repo_integration_test.go`（`BLOG_TEST_PG_DSN` skip 模式）锁 migration↔模型一致性，特别针对 anchor 列在 PG/SQLite 的差异。

## Blocked by

- Issue-0001（双轨认证 + viewer 注入 + `created_by` 列是契约前置；本 issue 的 CHECK 约束和 domain 校验都依赖 `created_by` 列存在）
