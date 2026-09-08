---
name: session-notes
description: Capture completed engineering outcomes as source-grounded articles or reusable notes, or rewrite an existing session article when requested. Articles require a clear reader payoff, a material-appropriate structure, evidence review, and an editorial gate before storage or publication; never auto-capture trivial, repetitive, or unfinished work.
---

# Session Notes

自动捕获在任务完成并验证后执行；显式 `/session-notes` 可补录既有成果，也可按用户要求重写已有文章。只通过博客 MCP 入库，不直接调用 HTTP 或数据库。用户只要求维护本 skill 时，不触发内容入库。

## 渐进加载

1. 从当前会话的最终成果筛候选：`类型 + 暂定主题 + 一句价值判断 + tags`，保留相关证据出处；不要把整场会话压成摘要后直接入库。
2. 笔记默认只读本文件；分诊、拆条或脱敏边界不清时读 [references/decision-guide.md](references/decision-guide.md) 对应小节。文章的新建、重写、恢复入库都必须先读 [references/article-workflow.md](references/article-workflow.md)，完成写作简报、取证、结构选择和成稿审查。
3. 先淘汰琐碎、重复和不满足意图测试的候选。文章必须给具体读者带来明确收益，并选择适合材料的组织方式；不能仅因改动多、功能完整或有参考长文就升为文章。
4. 正常入库只提问一次；MCP 不可用时允许追加一次“保存项目待恢复稿 / 不保存”提问。提问和成功报告均不回显正文。

## 1. 重量分诊

- **功能级**：已有完整成果和行为证据，能解释非显然机制、设计取舍、故障因果、实验发现或可复用操作。生成 `0..1` 篇可独立阅读的工程文章；实际保存为草稿还是发布，由第 5 节的用户授权与第 6 节的 MCP 权限共同决定。
- **经验级**：形成明确的坑、根因、修法或教训。按知识点生成 `0..N` 条笔记。
- **琐碎或重复**：不生成内容，不提问，保持沉默。价值不明确时按此处理。

完整落地不自动等于文章级。材料只支撑单点经验时，自动捕获降为笔记或不写；用户显式要求文章时不得偷换成摘要，应说明缺失的关键材料。`draft` 是当前存储状态，不降低成稿标准，也不代表永久禁止发布。

## 2. 拆条与查重

- 一条笔记只记录一个可独立检索的主题；同一因果链的现象、根因、修法保持一条。
- 笔记必须通过意图测试：首要目的是记录知识、供未来检索。情绪、状态、进度、碎碎念全部丢弃。
- `violet-notes` 可用时，成文前调用 `list_notes` 查重；仅对疑似同主题项调用 `get_note`。
- 已有同主题笔记且本次有新增事实时形成更新稿，后续调用 `update_note`；没有新增价值时丢弃；不得新建近义重复项。MCP 不可用时无法查重，恢复稿必须记录 `dedupe_status: pending`，恢复入库前再查重并决定 create、update 或丢弃。
- 用户要求重写已有文章时，先用 `get_post` 读取当前正文和元数据，以该 ID 更新；没有 ID 才用 `search_posts` 定位同主题草稿。禁止把改稿当新文章创建，也不自动覆盖已发布文章。

## 3. 成文

- 中文书写，术语与代码保持英文；事实陈述必须有对应证据，推演在结论旁说明前提和未复现范围。
- **笔记**：默认“现象 → 根因 → 修法”，教训类可省略根因；`150..400` 中文字，复杂根因最多 `800` 字。标题可选，有则直接点明可检索的知识点。
- **文章**：按文章专用流程先形成内部写作简报，识别材料类型并选择结构；成稿须通过读者收益、结构适配、证据边界、材料取舍与中文表达门禁。任一项失败先改稿，不进入裁定或入库。
- 文章标题准确说明对象和读者收益。篇幅、章节、图表与代码块均由材料决定，不设配额；不能用长篇、固定目录或视觉形式替代内容判断。
- 每项给 `2..4` 个英文小写 tags，如 `redis`、`css`、`deploy`。代码块标语言；完整示例必须执行最终版本再附真实输出，源码摘录不得冒充独立可运行程序。
- 不写营销腔、工具操作流水账或虚构第一人称经历。文章在结构审查后执行专用流程内的表达检查，不依赖其他写作 skill；润色不能代替结构重写，也不能改变事实和技术含义。

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
- 每篇成文进入裁定前都必须完成脚本扫描和模型语义自查。`clean` 仅代表敏感扫描通过，不代表文章质量合格。

## 5. 一键裁定

未获入库授权时，仅发起一次 AskUserQuestion 风格的选项式提问。只展示类型、标题、tags、一句摘要和扫描状态，不展示正文。用户已明确要求存草稿、更新指定草稿或发布时沿用对应授权，不重复裁定；授权改稿不等于授权发布。

- 可公开且 MCP 有发布工具、未明确拒绝所需权限的单条笔记或文章：`直接发布 / 存草稿 / 不发`。
- 敏感降级、发布工具缺失或明确缺少发布权限：`存草稿 / 不发`，说明限制原因。
- 多条均可发布：`全部直接发布 / 全部存草稿 / 逐条裁定 / 全部不发`；含不可发布项时不提供“全部直接发布”。
- 选择“逐条裁定”时，在同一次提问中为每项提供适用选项，降级项不出现“直接发布”。
- 工具可见不代表 PAT 一定有 scope。权限未知时，在发布选项中说明将由 MCP 鉴权，拒绝则保留草稿并报告；不假设文章 PAT 永远没有 `posts:publish`，也不自动扩权。
- 用户无应答、会话中断或提问失败时，按“存草稿”执行，不推断发布授权。

## 6. MCP 入库

### 笔记：`violet-notes`

- 新建调用 `create_note`：`{ title?, content_md, tags?, status }`。
- 默认 `status: "draft"`；仅当用户选择“直接发布”且敏感扫描通过时传 `status: "published"`。
- 更新调用 `update_note`：`{ id, title?, content_md, tags }`（content_md 必填，全量替换）。
- 查重使用 `list_notes` / `get_note`；“不发”时不调用 MCP。仅在用户明确要求撤回时使用 `delete_note`。

### 文章：`violet-posts`

- 调用前读取当前 MCP schema，以真实必填项与全量覆盖语义为准。新建先用 `create_post`：`{ title, slug, content_md, excerpt?, tags? }` 保存草稿，并记录返回 ID。
- 已有草稿用 `get_post` → `update_post`；携带 ID、改好的正文和完整元数据。默认保留 slug、封面、标签及 canonical URL，用户要求或改稿确实需要时才变更；Markdown 改稿不能同时透传旧 `content_html` 覆盖新正文。
- 草稿写入后用 `get_post` 核对正文、渲染源、目标 ID 和状态。回读一致是存储验证，不替代入库前的成稿质量门禁；核验失败不得报告完成。
- 用户明确选择或授权发布、成稿质量通过、敏感扫描与语义检查均通过时，允许调用 `publish_post`。实际发布要求 `posts:publish`；权限依据当前 MCP 的明确权限信息或发布调用的鉴权结果，不依据旧 skill 假设。
- 发布后再用 `get_post` 确认目标文章正文正确且状态为 `published`。只有确认后才能报告“已发布”。缺权限、调用失败或状态未确认时保留已保存草稿及 ID，说明“草稿已保存，发布失败/未确认”，不重复创建文章；超时后先回读状态再判断是否还需发布。
- 若用户选择保存恢复稿，已写入但尚未发布的文章记录 `operation: publish`、已有 `target_id`、目标 `status: published` 和真实发布授权。恢复时直接承接该 ID，不能把部分成功当作全失败重新 create。
- 已发布文章未经明确“更新线上内容”的授权不得自动覆盖；先形成待审稿。发布权限并不替代修改线上正文的用户授权。

## 7. MCP 不可用与恢复稿

MCP 工具缺失、连接失败、鉴权失败或调用失败时，不改用 HTTP、数据库或其他运输方式，也不把正文直接回显成最终交付。

1. 完成其他可执行的独立入库项，并保留每个失败项的标题、Markdown、tags、目标 MCP 工具、目标状态和原始错误。
2. 发起一次选项式提问，只提供：
   - `保存并提交项目恢复稿`：将失败项写入项目级 `.agents/session-notes/pending/`，并提交到当前分支。
   - `不保存`：删除临时文件，并在回复中完整回显失败项，确保内容不丢失。
3. 用户无应答、会话中断或提问失败时按“不保存”处理，避免未经同意向仓库写入文章正文。
4. 选择保存时，每个失败项写一个 Markdown 文件，命名为 `<UTC时间>-<slug>.md`。扫描通过后立即只提交本次新增或更新的恢复稿；不得把工作区其他改动带入该 commit。提交信息使用 `docs(session-notes): 保存待恢复内容`，body 只列标题、类型和目标 MCP，不包含正文。文件必须包含以下 YAML frontmatter：

```yaml
---
kind: note # note | post
operation: create # create | update | publish；publish 仅用于 post 已写入但尚待发布
target_id: "" # update / publish 时必填
status: draft # draft | published，表示用户选择的目标状态
publish_authorized: false # post 发布须有用户明确授权；旧稿缺此字段不推断为 true
title: ""
slug: "" # post 新建必填；更新沿用当前文章 slug
tags: []
excerpt: ""
dedupe_status: done # done | pending；post 固定 done
scan_status: clean # clean | needs-human-review
created_at: ""
last_error: ""
```

正文从 frontmatter 后开始，保持已完成扫描的 `content_md` 原文。恢复稿不得包含 PAT、Authorization header、账号、绝对路径或完整错误堆栈；`last_error` 只保留可操作的脱敏原因。

MCP 恢复后，显式 `/session-notes` 或下一次触发本 skill 时，先扫描 `.agents/session-notes/pending/*.md`：

1. 重新运行敏感扫描和模型语义自查；未通过的文件保持待恢复，不入库。`post` 还须按文章专用流程审查和必要时重写，不能因为旧稿已扫描通过就跳过质量门禁。
2. `note` 且 `dedupe_status: pending` 时先调用 `list_notes` / `get_note` 查重，随后把 operation 和 target_id 更新为最终动作；无新增价值则删除恢复稿并报告跳过。
3. 按 frontmatter 的 operation 和目标状态调用对应 MCP。`post` 按第 6 节新建、更新或发布；旧恢复稿缺 slug 时，新建根据标题生成，更新从 `get_post` 保留原值。`status: published` 还须有明确发布授权、当前质量/敏感检查通过和有效发布权限；`publish` 恢复先回读，若正文与已发布状态均已满足则不重复发布，若重新改稿则先更新并校验正文。
4. 仅在目标正文与目标状态回读确认后删除恢复稿，并单独提交删除。目标为草稿时不等待发布；目标为发布时不能只创建草稿就删除恢复稿或报告完成。
5. MCP 调用失败则更新 `last_error` 并提交该恢复状态，继续保留文件。不得把其他工作区改动带入恢复稿相关 commit。
6. 恢复完成后报告标题、状态、返回 ID、已删除的恢复稿路径和对应 commit，不回显正文。

## 8. 收尾

- 成功时只报告：每条笔记的标题、实际状态、`note_id`；文章标题、实际状态、`post_id`；每项敏感扫描结论。发布未完成时分开报告已保存的草稿与失败/未确认的发布步骤。
- 保存恢复稿时报告失败工具、脱敏错误、恢复稿路径、对应 commit 和后续将执行的 MCP operation，不回显正文。
- 删除不再需要的临时扫描文件。不得假报成功、静默放弃或把“已保存恢复稿”描述成“已入库”。
