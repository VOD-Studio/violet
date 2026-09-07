---
name: session-notes
description: Capture valuable outcomes when a coding session ends with a completed feature or reusable technical insight, or when the user explicitly invokes /session-notes to backfill one; never trigger for trivial, repetitive, unfinished, or purely conversational sessions.
---

# Session Notes

在任务完成并验证后执行；显式 `/session-notes` 时补录当前上下文中的既有成果。只通过博客 MCP 入库，不直接调用 HTTP 或数据库。

## 渐进加载

1. 仅从当前会话的最终事实、根因、修法和验证结果生成候选元数据：`类型 + 标题 + 一句价值判断 + tags`；不要重新总结整场会话。
2. 默认只读本文件。仅在分诊、拆条或脱敏边界不清时，读取 [references/decision-guide.md](references/decision-guide.md) 的对应小节；扫描自测也在该文件。
3. 先淘汰琐碎、重复和不满足意图测试的候选，再为剩余项成文。
4. 正常入库只提问一次；MCP 不可用时允许追加一次“保存项目待恢复稿 / 不保存”提问。提问和成功报告均不回显正文。

## 1. 重量分诊

- **功能级**：完整功能已落地并验证，且包含可复用的设计、实现链路或可靠性分析。生成 `0..1` 篇源码驱动的工程文章毛坯。
- **经验级**：形成明确的坑、根因、修法或教训。按知识点生成 `0..N` 条笔记。
- **琐碎或重复**：不生成内容，不提问，保持沉默。价值不明确时按此处理。

完整落地不自动等于文章级。仅有单点修改、常规操作或无法迁移到其他场景的结果不写文章。

## 2. 拆条与查重

- 一条笔记只记录一个可独立检索的主题；同一因果链的现象、根因、修法保持一条。
- 笔记必须通过意图测试：首要目的是记录知识、供未来检索。情绪、状态、进度、碎碎念全部丢弃。
- `violet-notes` 可用时，成文前调用 `list_notes` 查重；仅对疑似同主题项调用 `get_note`。
- 已有同主题笔记且本次有新增事实时形成更新稿，后续调用 `update_note`；没有新增价值时丢弃；不得新建近义重复项。MCP 不可用时无法查重，恢复稿必须记录 `dedupe_status: pending`，恢复入库前再查重并决定 create、update 或丢弃。

## 3. 成文

- 中文书写，术语与代码保持英文；只写已确认事实。
- 笔记默认采用“现象 → 根因 → 修法”；教训类可省略根因。
- 文章围绕一个完整功能或系统问题展开，先交代产品/工程边界，再沿数据模型、关键链路、失败场景和恢复语义逐层展开；章节由材料决定，不套固定数量。
- 文章必须区分三类结论：已经运行验证的行为、由源码/配置/迁移直接确认的事实、依据协议或数据库语义推演但尚未复现的风险。不得把单元模型、静态检查或局部 smoke test 写成端到端验收。
- 文章应解释关键取舍及其代价，保留尚未补齐的可靠性约束；源码片段只用于说明不变量、边界或失败模型，不按文件顺序复述实现。
- 标题可选；有则使用一句断言式短句。文章必须有标题。
- 每项必须给 `2..4` 个英文小写 tags，如 `redis`、`css`、`deploy`。
- 代码块必须标语言；命令、报错原文、diff 片段优先用代码块。
- 诚实低打磨；用第一人称记录踩坑过程，不写营销腔或夸大结论。
- 笔记默认 `150..400` 中文字，复杂根因最多 `800` 字。文章长度服从材料完整性：删除过程复述和通用背景，但不得为满足字数压缩关键边界、证据或失败语义。

## 4. 双层敏感门禁

对每篇成文分别写入临时文件并运行：

```bash
python3 .agents/skills/session-notes/scripts/scan-sensitive.py <file>
```

- 输出 `clean` 且退出码 `0` 才算机械扫描通过；退出码 `1` 为命中，其他退出码按失败处理。
- 脚本结论优先于模型判断；不得使用白名单、跳过标记或自我豁免。
- 模型继续检查脚本覆盖不到的语义敏感信息：可识别的服务器昵称、真实业务数据、内部路径、账号、内部拓扑和组合后可定位系统的信息。
- 能脱敏则改写并重新扫描，例如真实主机名改为“生产服务器”、绝对用户路径改为“本地项目目录”。
- 脱敏后失去价值时，保留必要内容，在开头标注 `> 含待人工处理的敏感信息`，并降级为“仅草稿”。
- 每篇成文进入裁定前都必须完成脚本扫描和模型语义自查。

## 5. 一键裁定

仅发起一次 AskUserQuestion 风格的选项式提问。只展示类型、标题、tags、一句摘要和扫描状态，不展示正文。

- 单条笔记且可公开：`直接发布 / 存草稿 / 不发`。
- 单条笔记且已降级：`存草稿 / 不发`。
- 单篇文章：`存草稿 / 不发`。文章毛坯永远只进草稿——发布权不在 AI 的 PAT scope 内（物理隔离），发布由作者在后台人工完成。
- 多条且全部可公开：`全部直接发布 / 全部存草稿 / 逐条裁定 / 全部不发`。
- 多条含降级项：`全部存草稿 / 逐条裁定 / 全部不发`。
- 选择“逐条裁定”时，在同一次提问中为每项提供选项；降级项与文章不得出现“直接发布”。
- 用户无应答、会话中断或提问失败时，全部按“存草稿”执行，不再次提问。

## 6. MCP 入库

### 笔记：`violet-notes`

- 新建调用 `create_note`：`{ title?, content_md, tags?, status }`。
- 默认 `status: "draft"`；仅当用户选择“直接发布”且敏感扫描通过时传 `status: "published"`。
- 更新调用 `update_note`：`{ id, title?, content_md, tags }`（content_md 必填，全量替换）。
- 查重使用 `list_notes` / `get_note`；“不发”时不调用 MCP。仅在用户明确要求撤回时使用 `delete_note`。

### 文章：`violet-posts`

- 调用 `create_post`：`{ title, content_md, excerpt?, tags? }`，只建草稿。
- 永远不调用 `publish_post`：捕获 PAT 从不授予 `posts:publish`，文章发布由作者在后台人工完成。

## 7. MCP 不可用与恢复稿

MCP 工具缺失、连接失败、鉴权失败或调用失败时，不改用 HTTP、数据库或其他运输方式，也不把正文直接回显成最终交付。

1. 完成其他可执行的独立入库项，并保留每个失败项的标题、Markdown、tags、目标 MCP 工具、目标状态和原始错误。
2. 发起一次选项式提问，只提供：
   - `保存项目待恢复稿`：将失败项写入项目级 `.agents/session-notes/pending/`。
   - `不保存`：删除临时文件，并在回复中完整回显失败项，确保内容不丢失。
3. 用户无应答、会话中断或提问失败时按“不保存”处理，避免未经同意向仓库写入文章正文。
4. 选择保存时，每个失败项写一个 Markdown 文件，命名为 `<UTC时间>-<slug>.md`。文件必须包含以下 YAML frontmatter：

```yaml
---
kind: note # note | post
operation: create # create | update；笔记查重未完成时先填 create
target_id: "" # update 时必填
status: draft # note 可为 published；post 固定 draft
title: ""
tags: []
excerpt: ""
dedupe_status: done # done | pending；post 固定 done
scan_status: clean # clean | needs-human-review
created_at: ""
last_error: ""
```

正文从 frontmatter 后开始，保持已完成扫描的 `content_md` 原文。恢复稿不得包含 PAT、Authorization header、账号、绝对路径或完整错误堆栈；`last_error` 只保留可操作的脱敏原因。

MCP 恢复后，显式 `/session-notes` 或下一次触发本 skill 时，先扫描 `.agents/session-notes/pending/*.md`：

1. 重新运行敏感扫描和模型语义自查；未通过的文件保持待恢复，不入库。
2. `note` 且 `dedupe_status: pending` 时先调用 `list_notes` / `get_note` 查重，随后把 operation 和 target_id 更新为最终动作；无新增价值则删除恢复稿并报告跳过。
3. 按 frontmatter 调用对应 MCP。`post` 永远只调用 `create_post` 建草稿；不得调用 `publish_post`。
4. MCP 返回成功 ID 后删除对应恢复稿；调用失败则更新 `last_error`，保留文件。
5. 恢复完成后报告标题、状态、返回 ID 和已删除的恢复稿路径，不回显正文。

## 8. 收尾

- 成功时只报告：每条笔记的标题、状态、`note_id`；文章标题、草稿状态、`post_id`；每项敏感扫描结论。
- 保存恢复稿时报告失败工具、脱敏错误、恢复稿路径和后续将执行的 MCP operation，不回显正文。
- 删除不再需要的临时扫描文件。不得假报成功、静默放弃或把“已保存恢复稿”描述成“已入库”。
