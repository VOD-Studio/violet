# ADR: mimo-music 双轨道任务编排约束

> 状态：已采纳
> 日期：2026-07-17
> 关联：[全功能蓝图 roadmap](../prd/mimo-music-netease-full-api-roadmap.md)、[musicctl roadmap](../../mimo-music/docs/musicctl-roadmap.md)、[架构 ADR](./mimo-music-architecture.md)

## 背景

mimo-music 有两条并行推进的轨道：

- **API 轨道**：网易云全功能蓝图（357 接口），按 Bounded Context 推进，产出 proto rpc + endpoint + service + model。
- **CLI 轨道**：musicctl 功能路线图，产出 cobra 命令 + 渲染层 + 实用能力。

两条轨道独立立项、各自有 PRD，新任务来了容易混淆该走哪条、谁阻塞谁。历史上出现过误判：把 CLI 实用功能（PRD-0013）当成"下一期 music 接口"，而真正的"下一期接口"指的是 API 蓝图的下一个 Context。

审计现状（2026-07-17）：9 个 domain 共 78 个 rpc，CLI 命令 100% 1:1 覆盖。最近一个 Context（读类扩展 PRD-0011）新增 16 个 rpc，其 CLI 命令在 Context 收尾时同步落地，无一遗漏。这说明「API 实现完即接 CLI」已是事实上的既定模式，本 ADR 把它写成约束。

## 决策

新任务必须先判断属于哪一类，再决定排期与落点。

### CLI 任务分两类

**A 类（契约保持型）** — API Context 实现完，新 rpc 必须接入 CLI。

- 触发：API Context 的实现工作完成时。
- 范围：该 Context 新增的每个 rpc，1:1 接入对应 domain 的 cobra 子命令。
- **硬约束**：Context 不把新 rpc 接入 CLI，不算收尾。理由：rpc 不暴露给用户等于未交付；历史已 100% 覆盖，此为既定事实而非可选。
- 原子性：CLI 接入与 API 实现可在不同 commit（遵循前后端/职责分离提交规范），但必须在同一 Context 范围内完成。

**B 类（能力扩展型）** — 不依赖新 rpc 的独立 CLI 能力。

- 触发：用户价值驱动的功能（下载/播放/歌词/批量等），由独立 PRD 立项。
- 范围：消费现有 rpc，构建新能力（本地落盘、音频播放、批量调度等）。
- 与 API 轨道解耦，可独立排期、并行推进。
- 若 B 类需要某个尚未实现的 rpc：先做该 rpc 所属 API Context（A 类连带完成 CLI 接入），再做 B 类；若只消费现有 rpc（如 PRD-0013），不被阻塞。

### 判定流程

新需求来了，先问三个问题：

1. **需要新 rpc 吗？** 是 → API Context（A 类，Context 内含 CLI 接入）。
2. **只消费现有 rpc 构建 CLI 新能力吗？** 是 → B 类 CLI 任务，独立 PRD。
3. **两者都不是？** → 重构/工程化/文档，独立处理，不归入两类。

### 优先级裁决

| 情形 | 裁决 |
|------|------|
| API Context 在做 | CLI 接入是 Context 内部一环，不单独排期，随 Context 收尾 |
| A 类 Context 与 B 类任务同时可做 | 按各自 PRD 的业务优先级排，不机械排序；无明确优先级时 A 类优先（补齐契约完整性的债务优先于增量功能） |
| B 类依赖未实现 rpc | rpc 所属 Context（A 类）先做，再 B 类 |
| 纯重构/工程化（无新 rpc、无新 CLI 能力） | 独立处理，不归入两类 |

## 后果

- 新任务归类清晰，不再把 B 类 CLI 功能误认为"下一期接口"，或把 A 类接口漏接 CLI。
- A 类的硬约束把"CLI 接入"从可选项变成 Context 收尾的强制项，杜绝「已实现的 rpc 用户用不到」的窗口期。
- B 类与 API 轨道解耦，PRD-0013 这类纯消费任务可以随时并行推进，不必等数字专辑等后续 Context。
- 每个 API Context 的 PRD/issue 拆分时，必须为 CLI 接入留出 issue（与最后一个实现 issue 同组，或单列「CLI 接入」issue）。

## 代价

- A 类硬约束把 Context 的工作量从「实现 rpc」扩大到「实现 rpc + 接 CLI」。这是有意识的取舍：与其让 rpc 长期不暴露、后续补 CLI 时还要重新理解 Context，不如在 Context 内一次性做完，上下文连续、改动原子。
- 优先级表里「无明确优先级时 A 类优先」可能与高价值 B 类需求冲突。此为默认裁决，遇到明确业务优先级（用户急用的功能）时以 PRD 优先级为准，A 类不机械插队。
