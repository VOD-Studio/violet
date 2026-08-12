# 操作日志 Action 粒度提升与 Summary 字段

Status: accepted

## 背景

操作日志领域模型（`domain/audit`）的五要素设计（谁 + 何时 + 做了什么 + 对哪个资源 + 变更了什么）结构完整，但实际表达力不足：

1. **Action 是 CRUD 万金油**：`SubscriptionFetched` 成功映射 `create`、失败映射 `update`，管理员看到 `create + subscription` 无法分辨"创建订阅"还是"抓取成功"。同一个 `update` 既代表改密码、改设置、也代表抓取失败。
2. **缺少人话摘要**：管理员看到 `subscription #uuid` + 一坨 metadata JSON，无法一眼判断发生了什么。需要点开详情、翻 metadata 才能拼出上下文。
3. **Metadata 承担了所有放不进别的字段的信息**（登录方式、批量数、抓取结果、改动的设置项），前端只能 `JSON.stringify` 裸展示。

## 决策

### 1. Action 提升为业务动词

Action 从 CRUD 粒度提升为业务动词粒度（动词原形祈使句），贯彻 `publish`/`login`/`approve` 已有的方向。新增 `fetch_feed`、`change_password`、`verify_email` 等业务动词，CRUD 动词（`create`/`update`/`delete`）只留给确实只是 CRUD 的操作（创建用户、删除角色）。

命名约定：动词原形（`fetch_feed`，不是 `feed_fetched`），与现有常量风格一致。

Action 不编码操作结果：`fetch_feed` 统一一个 Action，成功/失败靠 Metadata + Summary 区分。`login`/`login_failed` 作为历史特例保留（登录失败时无有效 Resource，语义上是不同事件）。

### 2. 新增 `Summary` 字段

`AuditEvent` 新增 `Summary string` 字段，后端 `mapEvent` 时生成中文摘要存库（如"拉取订阅源「少数派」失败：i/o timeout"、"批量禁用 12 个用户"）。前端零逻辑直接渲染。

Summary 是衍生字段，真相源是 Action + Resource + Changes + Metadata。国际化时可从结构化字段重新派生，不堵路。

### 3. Metadata 保持 `map[string]any`

Summary 解决了 90% 的可读性问题，Metadata 作为技术细节兜底，详情页裸 JSON 展示可接受。不拆分 Context/Result——不同事件的"输入"和"结果"结构千差万别，强行统一反而别扭。

### 4. 存量数据只管增量

`Summary` 允许空值，旧记录无 summary 时前端降级到 action + resource 拼接。不回填、不 UPDATE，守住 append-only 不变量。旧 Action 值保留不动。

## 理由

- **Action 业务化**：审计日志的核心消费场景是管理员扫一眼列表就知道"发生了什么"，`fetch_feed` 比 `create` + 翻 metadata 才能猜出是抓取，信噪比高一个量级。前端筛选也天然受益。
- **后端生成 Summary**：后端拥有事件的全部上下文（事件 payload 每个字段），拼摘要最自然。前端拼需要暴露每种事件的 metadata schema 再写映射逻辑——两套代码理解同一份数据结构，耦合更重。内部管理后台用户固定，国际化是 YAGNI。
- **不回填**：审计日志 append-only 是包注释写明的设计原则，回填 UPDATE 违背不变量。旧数据量有限，随时间自然沉底。
