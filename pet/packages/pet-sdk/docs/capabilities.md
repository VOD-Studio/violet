<!-- 由 scripts/gen-docs.mjs 生成,请勿手改。事实源:Rust 的 CAPABILITIES 与线上类型。 -->
# Pet 能力目录

规则版本:1。所有命令为 JSON,`op` 字段选择能力;64 位整数以十进制字符串编码。

| op | 作用 | 产生状态变化 | 成功响应类型 | 可能的错误 |
|---|---|---|---|---|
| `birth` | 由出生输入派生个体身份、稀有度、物种与基因 | 是 | `BirthResult` | `bad_input` |
| `act` | 对宠物执行喂食、休息、玩耍、治疗或等待,按逻辑时间结算病程 | 是 | `OutcomeResult` | `bad_input`、`dead`、`no_food`、`no_medicine`、`not_sick`、`too_tired`、`time_backwards`、`unsupported_rules`、`not_eligible` |
| `grant` | 发放经服务裁决后的奖励(经验、食物、药品、主题倾向);核心只校验单次上限 | 是 | `OutcomeResult` | `bad_input`、`dead`、`invalid_reward`、`time_backwards`、`unsupported_rules` |
| `evolution_options` | 列出当前阶段的进化分支,以及每个分支的缺项说明 | 否 | `EvolutionOptionsResult` | `bad_input` |
| `frame` | 将姿态与呈现时钟合成为字符单元网格 | 否 | `FrameResult` | `bad_input` |
| `sprite` | 将姿态、成长阶段与呈现时钟合成为像素画调色板与网格 | 否 | `PixelsResult` | `bad_input` |
| `verify_birth` | 核验出生证书的来源签名、承诺揭示与结果重算 | 否 | `VerdictResult` | `bad_input` |
| `capabilities` | 列出当前实现的全部能力与错误分类 | 否 | `CapabilityCatalogResult` | — |

「产生状态变化」表示调用方须把返回的新状态提交到存储;核心本身不写存储。

## 错误分类

- `bad_input` — 输入无法解析或字段非法。
- `dead` — 宠物已死亡,任何照料动作都被拒绝。
- `no_food` — 库存没有食物。
- `no_medicine` — 库存没有药品。
- `not_sick` — 宠物未处于生病阶段,无需治疗。
- `too_tired` — 精力不足以玩耍。
- `time_backwards` — `now` 早于宠物记录的 `last_tick`。
- `unsupported_rules` — 宠物保存时的规则版本不被当前实现支持,拒绝结算而不是猜测迁移。
- `not_eligible` — 进化条件未满足;缺项说明用 evolution_options 查询。
- `invalid_reward` — 奖励超出单次允许的范围。

失败响应为 `{ ok: false, code, message }`;按 `code` 分支,`message` 仅供人读。
