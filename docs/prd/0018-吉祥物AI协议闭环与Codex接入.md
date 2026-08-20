# PRD: AI 消息协议真实闭环与 Codex 接入

## Problem Statement

PRD-0017 已规划吉祥物引擎通用化,其中「AI 协议公开」止步于**注入面**:`handleAIMessage` 的 ref API + 规划中的 CustomEvent/postMessage 通道。但协议要「真实完成」,链路是五段,现状只有第五段的一半:

```
①采集(agent 进程内) → ②适配(事件→消息) → ③传输(跨进程) → ④汇聚(归一化) → ⑤注入(浏览器内)
   ✗ 缺              ✗ 缺              ✗ 缺            △ 部分            ✓ 现状
```

1. **协议本体不完整**。`{ emotionId, tips }` 两个属性是渲染指令而非语义事件:agent 侧知道的是「我在跑测试」,不该被要求学会 38 个表情 ID;没有寿命语义,agent 崩溃不发终止事件,组件永远停在 `error`(zombie state)。
2. **没有任何真实 agent 接入**。SDK 展示区的「AI 对接」是超前描述,消费方为零。第一个真实接入方选 Codex CLI——它有 hooks(10 个生命周期事件,含 MCP tool 调用拦截)与 notify(`agent-turn-complete`)两条事件外交通路,能力上足以驱动宠物。
3. **跨进程断链**。Codex 在终端进程,堇喵在浏览器进程,中间没有任何汇聚与下发通道。

## Solution

按「可独立演化」的标准分层:协议升级为**双层语义协议 v2**,每层经显式 SPI 解耦,Codex 为第一个接入方打通本地全链路。

### 架构分层(四层 SPI,各自可独立)

```
采集 adapters/          agent 事件 → AgentStatusMessage(适配器 SPI,agent 可插拔)
  └─ codex/             hooks + notify 脚本(T3,脚本形态分发,不进包)
协议 @violet/agent-status  消息 schema + 状态映射 + TTL 状态机(零 UI 依赖,可独立发布)
传输 transports/        AgentTransport SPI(subscribe/dispatch),通道可插拔
  ├─ sse/               浏览器 EventSource 消费(T2)
  ├─ custom-event/ post-message/  (PRD-0017 T2 范围,同一 SPI 下实现)
汇聚(站点私有,不进包)    本地 dev: Vite 中间件 + 状态文件(T2);远程: endpoint + Redis(P2)
```

- **协议层与吉祥物解耦**:agent 状态域组件无关,独立包 `@violet/agent-status`;mascot 包(PRD-0017 T1)消费它做表情映射。未来任何状态展示组件(仪表盘/进度条)均可消费同一协议。
- **依赖方向单向**:adapters → protocol ← transports;汇聚与 mascot 组件在两端消费。无环,无反向依赖。
- **新 agent 接入 = 新 adapter**(如 claude-code/),协议与传输零改动;新通道 = 新 transport 实现,协议与适配器零改动。

### 协议 v2(对标 ACP lean-schema 与 SSE 可靠性实践)

```ts
/** 语义状态:agent 工作状态的机器可读枚举,组件内置默认表情映射 */
type AgentState = "thinking" | "executing" | "error" | "done" | "idle";

interface AgentStatusMessage {
  type: "violet-mascot:agent-status"; // 命名空间化,与 CustomEvent/postMessage 通道共用
  agent: string;                      // 来源标识: "codex" / "claude" / 自定义
  state: AgentState;                  // 语义层:映射表情的主通道
  detail?: string;                    // 状态详情(正在跑测试/写文件),供 UI 呈现
  emotionId?: string;                 // 覆盖逃生舱:越过语义层直接指定表情(如 "35" 狂欢派对)
  tips?: string;                      // 对白气泡台词;缺省用该表情默认描述(v1 兼容)
  ttlMs?: number;                     // 寿命:超时自动回 idle,agent 崩溃即自然恢复(zombie 防护)
  seq: number;                        // 事件序列号:重连后按 seq 去重,乱序丢弃
  ts: number;                         // 毫秒时间戳
}
```

设计依据:

- **语义层为主、emotionId 为逃生舱**(双层):新 agent 零表情知识即可接入;特色表情(狂欢派对)经覆盖逃生舱保留表现力。
- **ttlMs 必选进协议**:挂死状态机是状态展示组件的必踩坑;事后加是破坏性变更([SSE/streaming 最佳实践](https://ably.com/blog/websocket-reconnection-timeouts-ai-agents):wall-clock timeout 防 zombie pending)。
- **seq/ts 必选**:传输通道断连重连后,组件按 seq 去重、按 ts 判过期(同 [SSE Last-Event-ID 重放模式](https://vercel.com/i/websocket-vs-server-sent-events))。
- **v1 兼容**:纯 `{ emotionId, tips }` 输入继续有效(归一化入口视为 `state` 缺省走覆盖路径)。

### 默认状态映射(内置,可被 emotionId 覆盖)

| AgentState | 表情 | 语义 |
|---|---|---|
| thinking | 思考中(#25) | 模型推理、规划 |
| executing | 忙碌处理(#34) | 工具执行中(跑测试/写文件) |
| error | 出错了(#27) | 失败/被阻断 |
| done | 任务完成(#28, ttl 播完回 idle) | 回合成功结束 |
| idle | 待机(#00) | 无任务/TTL 到期 |

### Codex 接入(第一个真实 agent)

Codex CLI 两条事件通路,互补使用:

| 通路 | 事件 | 映射 |
|---|---|---|
| hooks(~/.codex/config.toml,`/hooks` 信任一次) | SessionStart / UserPromptSubmit | → thinking |
| | PreToolUse(含 MCP tool 调用、Bash、apply_patch) | → executing(+detail=工具名) |
| | PostToolUse | → 保持 executing(detail 更新) |
| | Stop | → done |
| notify(user 级 config.toml,`notify=["脚本"]`) | agent-turn-complete(JSON 作 argv[1],含 last-assistant-message) | → done + tips=last-assistant-message 摘要 |

- hooks 提供过程粒度(被动、可靠);notify 是回合级兜底,`last-assistant-message` 是 tips 台词的天然来源。
- MCP tool 主动汇报(模型自觉调用)列为后续增强,不进一期——可靠性依赖模型,先验证被动通路。

### 本地传输形态(一期)

```
Codex hook/notify 脚本 → 写状态文件(dev 固定路径,单写者 JSON)
  → Vite dev 中间件 watch + SSE endpoint(/api/dev/agent-status)
  → 浏览器 EventSource → 组件归一化入口 → 堇喵
```

远程形态(POST endpoint + Redis pub/sub + SSE 下发)进 P2,协议与组件层设计不为其返工。

## User Stories

1. 作为 Codex 用户,我想在 violet dev 页面开着堇喵时,它实时反映 Codex 的工作状态(思考/执行/完成/出错),不用手动刷新。
2. 作为其他 agent(Claude Code 等)的适配器作者,我想只发语义状态就驱动堇喵,不学表情 ID。
3. 作为接入方,我想在 agent 崩溃后堇喵自动回到待机,而不是永远卡在错误状态。
4. 作为站点开发者,我想用 emotionId 覆盖逃生舱触发特色表情(任务完成→狂欢派对)。

## Implementation Decisions

- **落位**:协议 v2 + TTL 状态机 + transport SPI 建独立 workspace 包 `web/packages/agent-status/`(零 UI 依赖,subpath exports: "." 协议与状态机 / "./transport" SPI)。mascot 消费经 workspace 协议;PRD-0017 T1 包化时 mascot 上提引用关系不变。**不落 feature 目录**——包边界从第一天就是发布边界,后续独立仓库零迁移。
- **TTL 状态机**:`done`/`error` 默认 ttl 6s(播完庆祝/沮丧动画自然回 idle);`thinking`/`executing` 默认 ttl 120s(长任务防呆);显式 ttlMs 覆盖。
- **seq 由适配器维护**(进程内自增),组件只消费;重连后首条消息 seq ≤ 已见 seq 即丢弃。
- **通道优先级**:SSE(一期)> CustomEvent/postMessage(PRD-0017 T2 范围,同一 transport SPI 下实现)。
- **安全**:dev SSE endpoint 仅本地 dev server 暴露,不进生产路由;状态文件路径固定于项目 dev 工作区。
- **独立演化路径**:agent-status 包成熟(≥2 个 adapter、≥2 个消费组件)后可抽独立仓库,协议 schema 即公开契约;不因 violet 站点需求打站点私有补丁进包。

## 交付分期

| 期 | 内容 | 验收 |
|---|---|---|
| T1 | `@violet/agent-status` 包:协议 v2 类型 + 默认状态映射 + TTL 状态机 + transport SPI + v1 兼容归一化 | 包边界清晰(subpath exports);单测:语义映射/TTL 到期回 idle/seq 乱序丢弃/v1 兼容/emotionId 覆盖优先 |
| T2 | dev 传输链:SSE transport 实现 + Vite dev 中间件(watch 状态文件→SSE endpoint) + 堇喵经归一化入口消费 | dev 页面开着堇喵,注入测试消息,表情与 TTL 行为符合协议 |
| T3 | Codex adapter(hooks+notify 脚本)+ 接入文档 + SDK 区升级 | 按 SDK 区文档从零接入 Codex 成功一次,Codex 跑真实任务表情随生命周期切换 |

## Out of Scope

- 远程/多用户汇聚(endpoint + Redis + SSE 下发)——P2,协议不为其返工。
- MCP tool 主动汇报通道(模型自觉)——等被动通路验证后再评估。
- 表情包自定义/独立仓库(PRD-0017 P2)。
- 吉祥物进前台博客页面挂件位(PRD-0017 Out of Scope 保持)。
