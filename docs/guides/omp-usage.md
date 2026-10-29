# OMP 用量采集与个人看板

这个可独立安装的 OMP 扩展把已完成的 assistant 消息中的用量元数据发送到你配置的站点。在 Violet 登录后，打开自己公开主页（`/users/<用户名>`）资料栏的「用量」入口，即 `/users/<用户名>/usage`，查看 7 / 30 / 90 天的请求、Token、缓存、错误与费用估算。数据属于 PAT 对应的用户，不按电脑、项目目录或原始 session ID 分组。

**费用是 USD API 等价估算，不是订阅实际账单。** 扩展沿用 OMP 在该条消息上记录的 `usage.cost.total`，不读取订阅付款记录，也不重新计算供应商价格。免费额度、套餐、网关折扣与供应商最终结算可能不同。

## 安装与管理

使用 OMP 原生 Marketplace 安装，无需复制文件、安装完整 SDK 或发布 npm 包。需要支持 Marketplace 扩展加载的 OMP；本指南的安装命令依据 OMP **18.13.2** 的官方文档，采集实现仍依据 **18.12.1**（上游 `291e055`）的消息 API。

**发布状态：**以下远程命令依赖 PR [#633](https://github.com/VOD-Studio/violet/pull/633) 合入并让远程默认分支包含 catalog；合入前请使用下方本地安装，不能将远程源视为已可用。

```sh
# 注册插件源并查看可安装插件
omp plugin marketplace add VOD-Studio/violet
omp plugin discover violet

# 安装到当前 OMP profile，默认对该 profile 的所有项目生效
omp install omp-usage@violet
```

安装后退出并重新启动 OMP；扩展模块不能仅靠 `/reload-plugins` 完成加载。**安装不等于授权上传：**未配置站点和 PAT 时不采集、不建队列、不发送；接着按下文配置才会开始采集。

升级前退出使用该扩展的 OMP 进程，更新源与插件后重新启动：

```sh
omp plugin marketplace update violet
omp plugin upgrade --scope user omp-usage@violet
```

卸载同样需要退出并重启 OMP，命令不会删除独立保存的配置与待发队列：

```sh
omp plugin uninstall --scope user omp-usage@violet

# 可选：不再使用该源时，移除源注册
omp plugin marketplace remove violet
```

移除源不会代替卸载插件。需要仅在当前项目启用时，安装命令加 `--scope project`，升级、卸载也相应使用 `--scope project`。使用命名 profile 时，为这些命令选择与运行会话相同的 profile；插件状态由 OMP 管理，但本扩展的配置与队列固定在当前用户的 `~/.omp/` 下。

### 本地开发

在 Violet 仓库根目录使用原生本地安装；它链接整个扩展目录，不需要手动创建软链接：

```sh
omp install ./tools/omp-violet-usage
```

本地目录更新后重启 OMP 即可；不要对本地链接执行 Marketplace 升级。卸载使用包名：

```sh
omp plugin uninstall @violet/omp-usage
```

本地链接和 Marketplace 安装二选一，不要与旧的手动副本、`-e` 参数或其他配置重复加载。扩展的 `package.json` 以 `omp.extensions` 声明 `violet-usage.ts`；`runtime.mjs`、`events.mjs`、`spool.mjs` 必须与入口一起保留，运行时仅依赖 Node 内置模块。

维护者可运行以下命令，行为测试需要 Node 24+：

```sh
make omp-usage-extension-test
make omp-usage-extension-pack
```

打包默认输出到 `/tmp/`，可用 `OMP_USAGE_PACK_DEST` 指定目录；归档包含完整 `package/`，不向 npm 发布。安装与升级行为参见 OMP **18.13.2** 官方 [Marketplace 文档](https://github.com/can1357/oh-my-pi/blob/v18.13.2/docs/marketplace.md)与[插件安装机制](https://github.com/can1357/oh-my-pi/blob/v18.13.2/docs/plugin-manager-installer-plumbing.md)。

## 创建 PAT

1. 在 Violet 的个人访问令牌管理界面创建 PAT。
2. 只选择 `usage:write`，设置合适的有效期。上传不需要文章、评论或管理权限。
3. 将令牌保存到下面的本地配置。不要把 PAT 放进仓库、会话提示词、日志或截图。

写入接口通过 Bearer PAT 鉴权，不使用浏览器 Cookie，也不要求 CSRF token。过期或无效 PAT 返回 401，缺少 `usage:write` 返回 403；队列不会因此被丢弃。看板读取仍使用本站登录态，只能读取当前用户的数据。

## 配置目标站点

### JSON 文件

创建 `~/.omp/omp-usage.json`，内容如下；将示例值替换为实际站点与令牌：

```json
{
  "url": "https://your-blog.example",
  "pat": "YOUR_PERSONAL_ACCESS_TOKEN"
}
```

先创建文件并限制权限，再使用编辑器填入真实 PAT：

```sh
mkdir -p ~/.omp
touch ~/.omp/omp-usage.json
chmod 600 ~/.omp/omp-usage.json
```

`600` 只允许文件所有者读写。不要把真实 PAT 写进可被 shell history 记录的示例命令。

### 环境变量

`OMP_USAGE_URL`、`OMP_USAGE_PAT` 分别覆盖 JSON 中的 `url`、`pat`；可以只覆盖一项。以下仅展示语法，不应把真实令牌留在 shell history：

```sh
# POSIX shell
export OMP_USAGE_URL='https://your-blog.example'
export OMP_USAGE_PAT='YOUR_PERSONAL_ACCESS_TOKEN'
```

```fish
# fish
set -gx OMP_USAGE_URL https://your-blog.example
set -gx OMP_USAGE_PAT YOUR_PERSONAL_ACCESS_TOKEN
```

只支持这两个中性名称，不使用 `VIOLET_USAGE_*` 别名。URL 是站点基址，不是完整 batch 路径；扩展追加 `/api/v1/omp-usage/batch`。允许部署在路径前缀下的站点。不允许 URL 用户名/密码、查询串或 fragment；远端必须 HTTPS，本机 `localhost`、`127.0.0.1`、`[::1]` 可用 HTTP。上传不跟随重定向，以免将凭据发给另一目标。

两项均未配置时不采集、不建队列、不发送。只配置一项、配置文件无法解析或 URL 不合法时停止采集并提示固定错误信息，不输出配置原文。环境变量空字符串不会回退到 JSON。修改 JSON 会在后续采集和批次发送时重新读取；修改父 shell 环境变量只对新启动的 OMP 进程生效。

## 采集字段与隐私边界

只处理 `message_end` 的 `role === "assistant"`。不处理用户消息、工具结果或 streaming delta，也不会扫描历史会话补录。子会话复用扩展工厂，使用 `ctx.agent.kind === "sub"` 标识；不能用 `depth > 0`，因为某些子会话的 depth 为 0。

每个事件仅包含以下字段。HTTP 请求体只有 `events` 数组：

| 字段 | 来源 / 单位 |
| --- | --- |
| `client_event_id` | 64 位十六进制 SHA-256 摘要；稳定、不可逆向还原的事件身份 |
| `provider`, `model` | OMP 消息上的提供方与请求模型名称 |
| `input_tokens` | 非缓存输入 Token 数 |
| `output_tokens` | 输出 Token 数，包含提供方报告的 reasoning 部分 |
| `cache_read_tokens`, `cache_write_tokens` | 缓存读取 / 写入 Token 数 |
| `reasoning_tokens` | `usage.reasoningTokens`；未报告时记 0，**不代表模型没有推理** |
| `cost_total` | `usage.cost.total`，USD API 等价估算 |
| `stop_reason` | OMP `stopReason`，如 `stop`、`toolUse`、`length`、`error`、`aborted` |
| `is_error` | `stop_reason` 为 `error` 或 `aborted` |
| `duration_ms`, `ttft_ms` | OMP `duration` / `ttft`，毫秒；缺失或无效时为 null，不自行计时填补 |
| `is_subagent` | 子会话标记，不包含 agent 名称、任务内容或父会话 ID |
| `omp_version` | 运行中宿主导出的 `pi.pi.VERSION`，不是硬编码版本 |
| `occurred_at` | 消息 `timestamp` 转成 UTC RFC3339；通常代表请求起点，不是上传时间 |

Token 数是非负安全整数。提供方、模型、版本与停止原因上限分别为 128、256、64、32 个 UTF-8 字节；控制字符不可用。费用必须为有限非负数且不超过单事件 10¹² USD；已记录计时不能超过 `Number.MAX_SAFE_INTEGER`（9,007,199,254,740,991 毫秒）。越界计时记为 null；缺少必需用量、费用越界或其他不符合协议的快照不会上传，并给出不含内容的兼容性提示。

**不会读取或发送** prompt、正文、thinking 文本、工具参数/结果、文件名、路径、cwd、仓库名称、原始 session/entry/response ID、错误描述、provider payload、API key、PAT 或账户凭据标识。持久化和重试发送使用同一显式字段白名单；磁盘文件出现额外字段时保留本地并拒绝发送该文件。提供方和模型名称本身来自你的 OMP 配置，若自定义名称包含私人信息，请先改名。

只有内部计算摘要时会用到 session ID 和 provider response ID；原值不写入 spool 或 payload。没有上传前端可选择的 `user_id`，接收方必须从已验证 PAT 决定数据归属。

### 为什么不直接用 session entry ID

OMP 18.12.1 的 `MessageEndEvent` 只有 detached message，不带 entry ID；消息持久化排队后，扩展通知不等待持久化完成。因此 `getLeafEntry()` 既不能保证指向当前事件，也不能用消息对象引用比较。

扩展沿用宿主 `sessionMessagePersistenceKey` 的元数据维度：session、timestamp、provider、model、responseId、stopReason，并加入 completedAt 与四类 Token 数后做 SHA-256。相同快照重复发送保持相同 ID；不同 provider response ID 会得到不同 ID。没有 response ID 时，如果同一 session 在同一毫秒产生两条所有这些元数据完全相同的响应，无法在不检查正文、且宿主不暴露稳定事件 ID 的条件下保证区分，可能被视为一次。扩展不会为消除这一边界去收集正文，也不会用随机 UUID 破坏重试幂等。

源码依据：

- [18.12.1 扩展类型：MessageEndEvent、ExtensionAPI](https://github.com/can1357/oh-my-pi/blob/291e055/packages/coding-agent/src/extensibility/extensions/types.ts)
- [AssistantMessage 的 timestamp / duration / ttft / completedAt](https://github.com/can1357/oh-my-pi/blob/291e055/packages/ai/src/types.ts)
- [Usage 字段与 reasoning 语义](https://github.com/can1357/oh-my-pi/blob/291e055/packages/catalog/src/types.ts)
- [消息持久化顺序](https://github.com/can1357/oh-my-pi/blob/291e055/packages/coding-agent/src/session/agent-session.ts)
- [宿主消息身份规则](https://github.com/can1357/oh-my-pi/blob/291e055/packages/coding-agent/src/session/turn-persistence.ts)
- [宿主 VERSION 导出](https://github.com/can1357/oh-my-pi/blob/291e055/packages/coding-agent/src/index.ts)

## 持久化、重试与账号切换

队列位于 `~/.omp/violet-usage-spool/<目标与PAT摘要>/<事件摘要>.jsonl`。每个 JSONL 文件仅含一条白名单事件，权限为 `600`；新建目录为 `700`。这里有意使用**目录中每事件独立文件**，不是早期提案的单一 `violet-usage-spool.jsonl`：共享 JSONL 在「发送后截断」与另一个进程追加之间存在丢数据竞态。

落盘先写同目录唯一临时文件、fsync，再原子 rename 并同步目录。只有完成这一步才交给网络发送。确认后仅删除本次请求的事件文件，绝不截断共享日志或清空目录；另一个主/子会话或进程同时新增的不同事件不会被误删。正常全部送达后没有待发文件，可能保留空的目标目录。

- 启动时恢复当前配置的待发事件。
- 使用 OMP 托管的 60 秒 interval；同目标队列达到 50 条也触发发送。
- 每批最多 200 条；网络异步执行，不等待 HTTP 才结束 `message_end` handler。持久化本身是短同步本地文件操作。
- 单个请求 10 秒超时；失败后以 60 / 120 / 240 / 480 / 900 秒上限退避，下一个托管 interval 到达允许时间才重试。
- 只有 HTTP 成功且响应 `{ "data": { "accepted": N, "duplicated": M } }` 中两个非负整数之和等于该批事件数才删除。空响应、坏 JSON、计数不一致、401、403、429、5xx、网络失败均保留。
- 服务端已写入但响应丢失时会重放同一 ID，接收方以 `(user_id, client_event_id)` 去重，不重复计数。
- `session_shutdown` 最多等待 1.8 秒并中止未完成请求，低于宿主 2 秒预算；未确认事件留给下次启动。宿主关闭后才发出的最终中止用量仍会落盘，但不重新启动网络发送。

要求本机支持原子 rename 与目录 fsync 的文件系统（例如 macOS APFS、Linux 本地文件系统）；不把这个目录放在多主机共享网络盘上。不同进程不需要共享内存或易遗留的锁文件。磁盘满或权限错误会明确提示事件未能可靠落盘，不能承诺这种情况下仍不丢数据。若进程在临时文件完整写入后、rename 前退出，下次发送会检查临时文件名中的 PID：只有确认原进程已退出，且文件包含完整白名单 JSON、结尾换行和一致的事件摘要时，才将其原子恢复为待发文件。活进程的临时文件不会被移动；无法判断 PID 状态时也保守保留，PID 被系统复用时可能推迟恢复。损坏或不完整文件保留并提示，不发送半条记录。处理这些文件前应先退出所有 OMP 并备份目录；完整写入之前的崩溃与磁盘损坏不在持久化保证内。

### 改站点、改 PAT、轮换令牌

目标 URL 和 PAT 的联合 SHA-256 摘要只用于本机队列分区，不包含明文凭据、不会发送到服务器。新 PAT 即使属于同一个人，也使用新分区；扩展无法仅凭令牌知道它是否是同一账号。旧分区保留且提示，不会自动用新令牌上传旧账号数据，也不会静默丢弃。

轮换前最好先让旧 PAT 的队列送达；已有残留时恢复原站点与仍有效的原 PAT即可继续发送。原 PAT 已撤销或丢失时，需要用户在核对账号归属后另行处理旧数据，扩展不自动迁移分区。不要随意把分区内文件移到另一账号下面。每个配置只向一个站点发送，不提供多站点 fanout。

## 看板统计口径

- **总 Token** = input + output + cache read + cache write；reasoning 已包含在 output，不重复相加。OMP 原始 `totalTokens` 可能含供应商 orchestration 用量，不作为这里的总数来源。
- **缓存率** = cache read / (input + cache read + cache write)；分母为 0 时为 0。
- **错误率** = errors / requests；无请求为 0。主动中止也属于 `aborted`，因此错误率不等于供应商故障率。
- **tokens/s**：逐次计算 output / ((duration_ms − ttft_ms) / 1000)，再取平均。只包含非错误且两项计时存在、duration > ttft 的请求；缺计时不伪装成 0 速度。
- 平均耗时和 TTFT 忽略 null，真正记录的 0 是有效样本。
- 窗口按 UTC 日历计算：包含当日及前 N−1 日，截止当前时间；按天/小时缺失的时间桶补 0，不展示未来小时。
- 一条 assistant `message_end` 是一条请求记录。包括失败尝试和 tool-use 轮次，不等同于用户发送次数。没有经过这个生命周期的后台请求、历史记录、未加载扩展的会话不在采集范围内。

## 其他站点接入

采集器只依赖上述 HTTP/JSON 协议，不依赖 Violet 的 Go 实现。另一个站点可原生实现 PAT 验证和同一路径，使用共享 SQL/JSON 合约包 `api/pkg/ompusage/` 接收并展示 OMP 用量；该包的 README 规定参数、字段、单位及接入责任。Rust 的 Yggdrasil 是这一复用场景，**这份指南不表示 Yggdrasil 应用已完成接入或部署**。切换 `OMP_USAGE_URL` 不会自动创建该站点的端点、PAT 或看板，也不会共享两个站点的账号数据。
