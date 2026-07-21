# musicctl 功能路线图(2026-07)

承接 `musicctl-cli-design.md` 的架构决策,本文档规划 cobra 迁移后的剩余功能。
任务编排(本轨道与 API 蓝图如何穿插、CLI 任务分 A 类/B 类)见 [双轨道编排 ADR](../../docs/adr/mimo-music-dual-track-orchestration.md)。
决策已于 2026-07-17 与仓库 owner 确认:

- **第一阶段做 A 输出层**,后续新命令直接长在新输出层上,不返工
- **播放走内嵌 beep 方案**(零依赖单二进制),不做外部 mpv 调用
- **TUI 远期再做**,届时先用 bubbletea 列表选择器做小验证,再谈全屏播放器

总体顺序:**A 输出层 → C 实用功能 → B 配置 → E 工程化 → D TUI**。
(B/E 独立可穿插;C 依赖 A 的输出约定;D 依赖 C 的播放能力。)

---

## Phase A — 输出层(脚本与 AI agent 友好)✅ 已完成(2026-07-17,PRD-0012)

目标:结果走 stdout、提示走 stderr;TTY 给人类看,管道给机器看。

| 项 | 说明 |
|---|---|
| 全局 `--json` ✅ | 机器可读输出(即现在的 protojson,改为此 flag 触发) |
| 默认人类可读 ✅ | 列表型响应渲染为对齐表格(runewidth CJK 对齐);单对象渲染为嵌套键值对 |
| TTY 检测 ✅ | stdout 非 TTY(管道/重定向)时自动回退 JSON,禁止交互提示 |
| 全局 `--yes` ✅ | 写操作跳过 y/N 确认(脚本场景);非 TTY 且无 `--yes` 时写操作直接报错 |
| 退出码规范 ✅ | 0 成功;1 通用错误;2 用法错误;3 未登录 |
| login-status 脱敏 ✅ | cookie 分段保留首尾 8 位,`--json` 全量输出 |

落点:`internal/cli/kit/output.go` 扩为渲染层(`Render(w, msg)`,按 proto 类型分发表格渲染器);
各领域包把 `kit.PrintExec` 换成 `kit.RenderExec`,行为由全局 flag 驱动。

验收:`musicctl search --keyword 周杰伦` 出表格;`... | jq` 管道直接拿到 JSON;
`musicctl song like --id 1 --yes` 无交互完成;非 TTY 写操作无 `--yes` 报退出码 2。

## Phase C — 实用功能(核心用户价值)✅ 已完成(2026-07-20,PRD-0013)

| 功能 | 命令 | 说明 |
|---|---|---|
| 下载 | `song download --id [--level] [--out .]` | song url → 落盘,文件名 `{艺术家} - {歌名}.{ext}`,写 ID3 元数据(标题/艺人/封面) |
| 播放 | `song play --id [--level]` | beep 内嵌播放,见下节技术方案 |
| 歌词 | `lyric --id`(已有)+ `song play --lyric` | 播放时终端同步滚动歌词( karaoke 式,依赖 play 的时间轴) |
| 歌单批量 | `playlist download --id [--level] [--out .]` | 整单下载,并发 3,断点续传(已存在跳过) |

### 播放技术方案(beep 内嵌)

- 依赖:`github.com/gopxl/beep`(faiface/beep 的维护分支)+ 其 mp3/flac 子包;
  音频输出经 oto v2,macOS/Linux/Windows 通吃
- 链路:`song url --level X` 拿播放地址 → `http.Get`(带 Referer/UA)→
  响应体直接喂 `mp3.Decode`/`flac.Decode`(流式解码,无需先下完)→
  前置一个缓冲 goroutine(默认 5s 水位)抗网络抖动 → `beep.Speaker` 播放
- 交互:空格暂停/继续,←/→ seek,↑/↓ 音量,q 退出
- 抽象:`internal/cli/player` 定义 `Player` 接口(Play/Pause/Seek/Volume/Progress),
  实现与命令层解耦——与将来 TUI 复用同一接口,这也是 go-musicfox 验证过的结构

验收:任意目录 `musicctl song play --id 347230` 出声;弱网下不卡顿(缓冲水位生效);
`--level 3`(flac)可播;`playlist download` 整单落盘带元数据。

## Phase B — 配置

- 配置目录 `os.UserConfigDir()/musicctl/`:`config.toml`(默认音质 `level`、默认输出 `output = "table"|"json"`、下载目录)
- 会话文件从 `~/.musicctl/session.json` 迁至配置目录,**读时兼容旧位置**(旧位置存在则继续使用并提示可 `musicctl config migrate`)
- 新增 `config` 命令组:`config path` / `config get` / `config set key value`

## Phase E — 工程化与可发现性 📋 待实现(PRD-0014)

> 可发现性(补全/onboarding/别名/召回池)属[双轨道 ADR](../../docs/adr/mimo-music-dual-track-orchestration.md)第三类——纯 CLI 工程化,不消费 rpc,与 goreleaser/测试/文档同类。不单列 Phase F,并入此节。

### 工程化(原有)

- **goreleaser**:tag 触发 GitHub Actions,产 macOS(arm64/amd64)/Linux/Windows 二进制 + checksums;`brew tap` 后置
- **CLI 层测试**:命令构造单测(flag 解析、required 校验、命令树完整性——78 RPC 与命令一一对应的守护测试);kit 的 session/output 单测
- 文档:`musicctl <cmd> --help` 已自足,补 `docs/musicctl.md` 用户手册(安装/登录/常用流)

### 可发现性与补全(新增,详见 CONTEXT.md「musicctl CLI」段术语)

- **命令补全**:启用 cobra `completion` 子命令(bash/zsh/fish/powershell);help 分 5 组(快速上手/账号/音乐/发现/工具),`--help-verbose` 列全部
- **参数补全**:**只走缓存**(召回池),绝不实时查网易云——见 CONTEXT.md「补全只走缓存」。`--id <TAB>` 列召回池候选(最近搜索/红心/歌单成员),`--level`/`--area`/`--op` 固定枚举
- **召回池(Recall Pool)**:三类来源汇一池——主动(search/detail)+ 隐式(任何 `--id` 成功消费后透明埋点,**基础设施级,A 类 Context 接入新 rpc 时无需关心**)+ 远端(红心/歌单快照,24h TTL)。持久化 `~/.musicctl/history.jsonl`(append-only JSONL,1000 行上限,三类用 `src` 字段区分)。预热用「磁盘秒级 + 后台异步拉」,goroutine **fire-and-forget**(不等待、tmp+rename 原子写),绝不阻塞主命令/onboarding
- **裸跑 onboarding**:工具型定位(不进 TUI)。未登录→登录引导;已登录→四分时段场景化(晨 06-11 daily-songs / 午 11-18 playlists / 晚 18-23 fm / 夜 23-06 复听召回池),**周末优先级高于时段**,时区取本地。可补全命令用 `<TAB>` 标注
- **双字符别名**:`pp`=song play、`dl`=song download、`pll`=playlist download、`se`=search、`rd`=recommend daily-songs、`whoami`=login-status(不用 `ls`,避 unix 心智冲突)。别名不进 tab 补全,必须在 onboarding/--help 显式列出
- **位置参数**:所有单值 `--id` 命令 + `search --keyword` 支持 `<value>` 等价 `--flag <value>`;同时给报歧义错;`--uid`/`--tracks` 不纳入
- **`musicctl doctor`**:环境自检(版本/会话/网络/补全/音频后端),bug report 第一手信息
- **`musicctl recent`**:列召回池内容(最近搜索/播放/下载),既是查看命令也是补全离线源

## Phase D — TUI(远期,先小验证)

- 第一步(小验证):`musicctl tui`(或 `search --tui`)bubbletea 列表选择器:
  搜歌 → ↑/↓ 选择 → Enter 调 Phase C 的 `player.Player` 播放。验证手感与技术栈
- 第二步(全屏播放器):队列、歌词面板、快捷键体系,单独立项,参考 go-musicfox
  的 menu/player 接口划分,不照搬其代码

---

## 不做清单(明确排除)

- 不做外部 mpv/afplay 播放后端(已选定 beep 内嵌,避免双后端维护)
- 不做旧平铺命令名的兼容别名(工具未发布)
- 不做账号密码登录(网易云已关闭该通道,扫码/验证码已覆盖)
