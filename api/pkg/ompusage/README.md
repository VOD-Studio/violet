# OMP 用量 PostgreSQL 契约

Schema 版本：**1**。本包分发语言无关的 PostgreSQL schema、JSON 事件契约和参数化 SQL。Go 宿主使用嵌入资源；Rust 宿主可以用 `include_str!` 读取分发包中的 SQL。不提供独立运行服务，不依赖 GORM、宿主认证或 Go/Rust FFI。

Violet 适配器原样执行这些 SQL。仓库中的 Rust 消费者夹具验证相同分发资源，不代表 Yggdrasil 应用及 UI 已完成接入。

## 资源与参数绑定

在宿主独立管理的 PostgreSQL schema 中执行一次 `schema.sql`。`user_id` 为宿主认证身份提供的不透明字符串。各部署自行管理数据库和 schema，本包不跨站共享账户，也不负责认证。

| 资源 | 位置参数 | 结果 |
| --- | --- | --- |
| `queries/ingest.sql` | `$1 text` 用户 ID；`$2 jsonb` 已校验的事件数组，**不是** `{events: [...]}` 包装对象 | 一行：`accepted bigint`、`duplicated bigint` |
| `queries/summary.sql` | `$1 text` 用户 ID；`$2 timestamptz` 窗口起点（含）；`$3 timestamptz` 当前时间（含） | 一行汇总；无数据时所有数值为零 |
| `queries/models.sql` | 同 summary | 按 total_tokens 降序、provider/model 升序；无数据时零行 |
| `queries/timeseries.sql` | 同 summary；另加 `$4 text`，只能为 `day` 或 `hour` | 完整补零、升序的 UTC 桶，截止当前桶，不含未来小时 |

必须使用参数绑定，不可将用户输入拼进 SQL。索引 `(user_id, occurred_at)` 将聚合扫描限定为一个用户的指定窗口。唯一键 `(user_id, client_event_id)` 保证并发写入与批内重复的幂等性，重复项不修改原数据。每批是一个原子 SQL 语句；`created_at` 由 PostgreSQL 赋值，不接受客户端传入。

### 返回列顺序

- Summary：`requests`、`errors` 为 `bigint`；随后 `error_rate`、`total_tokens`、`input_tokens`、`output_tokens`、`cache_read_tokens`、`cache_write_tokens`、`reasoning_tokens`、`cache_rate`、`api_cost_estimate`、`avg_duration_ms`、`avg_ttft_ms`、`avg_tokens_per_second` 为 `double precision`。
- Models：`provider`、`model` 为字符串；`requests`、`errors` 为 `bigint`；随后 `total_tokens`、`input_tokens`、`output_tokens`、`cache_read_tokens`、`cache_write_tokens`、`reasoning_tokens`、`cache_rate`、`cost`、`avg_tokens_per_second`、`avg_ttft_ms` 为 `double precision`。
- Timeseries：`timestamp` 为 `timestamptz`；`requests`、`errors` 为 `bigint`；`total_tokens`、`api_cost_estimate` 为 `double precision`。时间戳序列化为 RFC3339 UTC。

Token 求和先使用 PostgreSQL `numeric`，输出再转浮点数；单次计数保持安全整数。累计值可能超出 JavaScript 精确整数范围，界面不应暗示超出 JSON 数值精度的准确性。

## 原生宿主职责

1. 摄取认证与浏览器 Cookie/CSRF 分离。Violet 复用原 PAT 校验器并精确要求 `usage:write`；事件 JSON 不得接受 `user_id`。看板查询使用宿主的浏览器 Session。
2. 调用 SQL 前校验**整个批次**：拒绝未知字段、缺少必填字段、非有限数、超大请求和非法时间戳。SQL 约束仅作纵深防御，不替代请求 schema 校验。
3. 每批接收 1–200 个事件、最多 512 KiB。`event.schema.json` 描述单个事件。字符串不得全为空白，须为有效 UTF-8 且不含 Unicode 控制字符。JSON `maxLength` 为字符数，宿主还须检查 UTF-8 字节上限：事件 ID128、provider128、model256、stop_reason32、omp_version64。事件 ID 使用 `[A-Za-z0-9._:-]+`，须为不透明标识或哈希，不能直接传原始 session ID 或路径。提示词、正文、仓库名、工作目录和文件路径不属于协议。
4. 五项 token 计数均为必填整数，范围 `0..9007199254740991`；错误及子代理标记须显式给出布尔值。成本为 `0..1e12` 的有限美元数值；宽松的单次上限用于防止极端输入导致浮点聚合溢出。duration/TTFT 为可省略、可空的有限毫秒数，范围 `0..9007199254740991`，实测零值合法，不得伪造缺失测量。`occurred_at` 必须为以 `Z` 结尾的 RFC3339 UTC，最多领先服务器五分钟，无任意历史保留期限限制。
5. range 只能为 `7d`、`30d`、`90d`，默认 `30d`；bucket 只能为 `day`、`hour`，默认 `day`。起点为 UTC 今日零点减 N−1 天，终点为同一次捕获的当前时间。不要开放调用方 user_id 或任意时间窗口。最多返回90个日桶或2160个小时桶。
6. 为摄取设置独立限流。Violet 默认每认证用户每分钟60次，超限返回 `429` 与 `Retry-After`。数据库失败须返回服务端错误，不得确认未提交的批次。
7. 无模型行时返回 `models: []`，保留补零后的时间序列。使用宿主统一的成功/错误信封，禁止共享缓存私有结果。

## 指标口径

- `total_tokens = input + output + cache_read + cache_write`；reasoning 已是 output 子集，不重复相加。
- `cache_rate = cache_read / (input + cache_read + cache_write)`；`error_rate = errors / requests`。零分母返回零，数值为比率而非百分数。
- `avg_tokens_per_second` 是**单次调用速率的平均值**：`output_tokens / ((duration_ms - ttft_ms) / 1000)`。仅计非错误、两项耗时均存在且生成间隔为正的调用；缺测或无效间隔被排除，不当作零插入。
- 耗时均值包含实测零值，忽略缺测值；无有效测量时返回零。
- 成本为运行时上报的 **API 等价美元估算**，不是实际订阅账单或发票金额。

## 迁移快照与分发验收

`schema.sql` 是提供方初始 schema 的唯一来源。Violet 的 `api/migrations/143_create_omp_usage_events.up.sql` 是其逐字节一致的不可变快照。仅在首次建立该迁移时，从仓库根目录生成并比对：

```sh
cp api/pkg/ompusage/schema.sql api/migrations/143_create_omp_usage_events.up.sql
cmp api/pkg/ompusage/schema.sql api/migrations/143_create_omp_usage_events.up.sql
```

发布后升级 provider 版本并新增宿主迁移，不修改已发布的迁移143。`make omp-usage-sql-pack` 检查快照一致性，将 SQL、JSON schema、README 和许可证打入归档；下列验收入口另外从仓库复制 Rust 消费者到外部临时目录，以解包后的共享资源编译并运行验收：

```sh
make omp-usage-sql-consumer
```

执行外部 Rust 消费者时，将 `BLOG_TEST_PG_DSN` 指向隔离的 PostgreSQL 测试数据库。归档默认输出到 `/tmp`，可用 `OMP_USAGE_PACK_DEST` 指定目标路径。凭据不得进入日志或版本库。以上描述的是验收方法，每次更改契约后应重新执行。
