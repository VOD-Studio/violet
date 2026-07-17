# PRD: musicctl 输出层(人类可读 + 脚本友好)

> 状态:📋 待实现
> 关联:[CLI 架构设计](../../mimo-music/docs/musicctl-cli-design.md)、[CLI 路线图](../../mimo-music/docs/musicctl-roadmap.md)(Phase A)
> 范围:musicctl 全部 77 个命令的输出形态。不涉及 endpoint/service 层,不改任何接口行为。

## Problem Statement

musicctl 完成 cobra 迁移后,所有命令的输出仍是清一色的 protojson 大 JSON。这带来两类日常摩擦:

- **人类难读**:搜一首歌要在一屏嵌套 JSON 里找歌名和 id;列表型结果(歌曲/歌单/专辑)没有对齐的表格视图,肉眼扫不动。
- **脚本难用**:写操作必须人工敲 `y` 确认,无法进脚本;管道给 `jq` 时输出混在交互提示里;退出码只有 0/1,脚本无法区分「未登录」和「接口报错」;`login-status` 把完整 cookie 打到终端,截图/录屏即泄露。

CLI 的第一类消费者正在从人扩展到脚本与 AI agent——输出形态需要同时服务两者:TTY 给人类看,管道给机器看。

## Solution

建立统一输出层,按输出目的地自动分派形态:

- **TTY(人类)**:列表型响应渲染为对齐表格,单对象渲染为键值对;写操作保持交互确认。
- **管道/重定向(机器)**:自动回退完整 JSON(现状行为),禁止一切交互提示;写操作无 `--yes` 直接报错退出。
- **显式控制**:全局 `--json` 强制 JSON,全局 `--yes` 跳过写确认;退出码区分错误类别(未登录/用法错误/通用错误);`login-status` 人类模式下 cookie 脱敏。

渲染逻辑收进 `internal/cli/kit` 的渲染层,命令包零感知——`PrintExec` 换 `RenderExec`,行为由全局 flag 驱动,后续新命令自动获得全部能力。

## User Stories

1. 作为 CLI 用户,我希望 `musicctl search --keyword 周杰伦` 输出对齐的歌曲表格(id/歌名/艺人/专辑),以便肉眼快速扫到目标。
2. 作为 CLI 用户,我希望歌单/专辑/歌手/用户等列表响应都以表格呈现,以便保持一致的阅读体验。
3. 作为 CLI 用户,我希望单对象响应(歌曲详情、账号信息)以键值对呈现,以便不比 JSON 难看。
4. 作为脚本作者,我希望 `--json` 拿到完整 protojson 输出,以便用 `jq` 精确取字段。
5. 作为脚本作者,我希望管道/重定向时自动输出 JSON 且无交互提示,以便命令直接进管道。
6. 作为脚本作者,我希望 `--yes` 跳过写操作确认,以便收藏/歌单管理可以批量化。
7. 作为脚本作者,我希望非 TTY 环境下的写操作没有 `--yes` 时直接报错退出,以便错误配置尽早暴露而不是挂起等输入。
8. 作为脚本作者,我希望退出码区分未登录(3)/用法错误(2)/通用错误(1),以便脚本按错误类别分支处理。
9. 作为 CLI 用户,我希望 `login-status` 默认脱敏 cookie(只显示首尾片段),以便截图/录屏不泄露凭证;需要完整值时用 `--json`。
10. 作为 CLI 用户,我希望进度/警告类提示走 stderr、结果走 stdout,以便 `musicctl ... > out.json` 不被污染。
11. 作为后续功能开发者,我希望新命令只需调用渲染层就自动获得表格/JSON/TTY 三态行为,以便不再为输出写任何样板。

## Implementation Decisions

### 渲染层(kit 新增,核心模块)

- 基于 protoreflect 的**通用渲染器**,不为每个响应类型写定制代码:
  - 响应含 repeated message 字段 → 每个非空 repeated 字段渲染一段**表格**(多段时各带小标题,如 search 的 Songs/Albums 分段);列取条目的标量字段(string/int/bool/enum),枚举显示枚举名,嵌套 message 取其 `name` 字段 join(如 artists),单元格超宽截断;`text/tabwriter` 对齐。
  - 无 repeated 字段 → **键值对**逐行渲染标量字段,嵌套/repeated 子结构退化为紧凑 JSON。
  - 渲染输入 proto.Message、输出 string 的**纯函数**,是输出层唯一 seam。
- 全局状态挂在 kit 实例:`JSON`/`Yes` 两个布尔,由 root 的 persistent flags 绑定;TTY 检测用 `golang.org/x/term`(可注入替身便于测试)。
- 命令接入:`PrintExec` → `RenderExec`(执行 endpoint 后按三态规则分派:JSON 模式或非 TTY → protojson;否则表格/键值)。动态 path 的 raw 命令(PrintRaw)保持现状——pretty JSON 对人已可读。

### 确认交互(写操作)

- `ConfirmWrite` 签名改为返回 `(确认 bool, 错误 error)`:`--yes` 直通;非 TTY(stdin 非终端)且无 `--yes` 返回用法错误;TTY 保持现有 y/N 提示。
- 全部 11 个写命令改为:出错返回 error,用户取消返回 nil(打印「已取消」,退出码 0)。

### 退出码

- `0` 成功;`1` 通用错误(接口/网络/解析);`2` 用法错误(flag 解析失败、非 TTY 写操作无 `--yes`);`3` 未登录(`ErrNotLogin` 哨兵错误,`RequireLogin` 返回)。
- 映射集中在 `cli.Execute`:errors.Is/As 判型后 `os.Exit`。

### login-status 脱敏

- 人类模式:cookie 各段只保留首尾 8 字符,中间 `...` 省略,并提示「完整值用 --json」;JSON 模式保持全量(脚本取凭证是合法用途)。

### 消息流向

- 「已删除/已更新/已登出」等动作确认消息保持 stdout(与 git/kubectl 一致,它们就是该命令的唯一产出);⚠ 警告、轮询进度、确认提示走 stderr。

## Testing Decisions

- **主 seam:渲染器纯函数**。golden 测试覆盖:单段表格、多段表格(search 形态)、键值对、嵌套 message 取 name、枚举显示、超宽截断、空 repeated 字段跳过。fixture 用真实 proto 类型(`SearchResponse`/`HotResponse`/`Session` 等),不 mock。
- **ConfirmWrite**:注入 TTY 开关与 stdin,覆盖 yes 直通/非 TTY 报错/取消/确认四态。
- **退出码映射**:root 层小测试,各类错误映射到正确退出码。
- **真机 smoke**(实施后人工跑一遍):`search --keyword` 出表格;`search --keyword | jq` 拿到 JSON;`song like --yes` 免交互;`ssh 非 TTY` 写操作报退出码 2;未登录命令退出码 3。
- 参考先例:endpoint 层的 fixture 测试风格(internal/netease/endpoint/*_test.go)。

## Out of Scope

- 颜色/lipgloss 美化、表格排序与列选择、分页器、交互式选择(属 Phase D TUI 范畴)
- `config.toml` 默认输出格式配置(Phase B,届时输出层读配置即可)
- 下载/播放/歌词滚动(Phase C)
- shell completion 的细粒度定制(cobra 默认已可用)
- goreleaser 发版(Phase E)

## Further Notes

- 输出层是 Phase C 的地基:下载/播放命令的进度展示、列表选择都会长在这层上,渲染器 API 设计时预留进度/状态类输出的扩展位(但不提前实现)。
- 本 PRD 只动 `internal/cli/**` 与 `cmd/musicctl`,不触碰 `internal/netease/**` 与 gRPC 服务。
