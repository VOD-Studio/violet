# PRD: musicctl 实用功能(下载/播放/歌词/批量)

> 状态:📋 待实现
> 关联:[CLI 路线图](../../mimo-music/docs/musicctl-roadmap.md)(Phase C)、[输出层 PRD](./0012-musicctl-输出层.md)(已完成)
> 范围:musicctl 新增 4 个实用命令。不改 endpoint/service 层;播放与下载只消费现有 song url/lyric 接口。

## Problem Statement

musicctl 目前是一个"查询工具":能搜、能看、能管理收藏,但**不能听、不能存**。用户的真实场景是:听到一首好歌想立刻在终端播放;想把歌单离线到本地(通勤/备份);播放时想看歌词跟着走。这些都不需要打开网易云 App——CLI 已经握着全部接口和登录态,缺的只是"最后一公里"的落地能力。

## Solution

在输出层(Phase A)之上补四个实用命令,全部围绕现有接口的直接消费:

- `song download --id`:单曲下载到本地,带完整元数据(标题/艺人/封面),文件名可读。
- `song play --id`:内嵌 beep 播放,零外部依赖,键盘控制(暂停/进度/音量),弱网不卡。
- `song play --lyric`:播放时歌词按时间轴同步滚动。
- `playlist download --id`:整单批量下载,小并发,已存在跳过,可反复执行续传。

播放核心抽成独立 `Player` 接口——命令层只做"拿 URL → 交给 Player",未来 TUI 复用同一接口(go-musicfox 验证过的结构)。

## User Stories

1. 作为用户,我希望 `musicctl song download --id 347230` 把歌存到本地,文件名叫「Beyond - 海阔天空.mp3」,以便脱离 App 收听。
2. 作为用户,我希望下载的 mp3/flac 自带标题、艺人和封面,以便在音乐软件里正常显示。
3. 作为用户,我希望 `--level 3` 下载无损 flac,以便保留音质。
4. 作为用户,我希望 `--out ~/Music` 指定下载目录(默认当前目录),以便按需归档。
5. 作为用户,我希望 `musicctl song play --id 347230` 立刻出声,不用装任何外部播放器,以便即搜即听。
6. 作为用户,我希望播放中按空格暂停/继续、←/→ 快退快进、↑/↓ 音量、q 退出,以便不碰鼠标控制播放。
7. 作为用户,我希望地铁弱网下播放不频繁卡顿,以便连续听完(启动前缓冲数秒)。
8. 作为用户,我希望 `song play --lyric` 播放时歌词一行行跟着走,以便边听边看。
9. 作为用户,我希望 `musicctl playlist download --id <id>` 把整个歌单拉下来,已存在的文件自动跳过,以便中断后重跑续传。
10. 作为脚本作者,我希望下载/播放命令在非 TTY 环境报用法错误而不是挂起等键盘,以便 CI 不误用。
11. 作为后续 TUI 开发者,我希望播放逻辑收敛在一个 Player 接口后面,以便将来直接复用。

## Implementation Decisions

### 下载(song download / playlist download)

- 链路:`song url --level X` 拿播放地址(响应含 format=mp3/flac)→ HTTP GET(带 Referer/UA)→ 落盘 `{艺术家} - {歌名}.{ext}`(文件名过滤路径分隔符)→ 写入元数据。
- 元数据用 `github.com/dhowden/tag`(同时支持 mp3 ID3v2 与 flac vorbis comment);封面经 `song detail` 的专辑图 URL 下载后内嵌。
- 单曲信息(歌名/艺人/专辑)取自 `song detail`,文件名中的艺术家取首个艺人。
- 已存在同名文件 → 跳过并提示(playlist download 的断点续传语义);单曲下载可用 `--force` 覆盖。
- 批量:遍历 `playlist tracks` 全量(已有接口),并发 3 个 worker,各自独立走完单曲链路;单首失败不中断,结束汇总成功/失败/跳过计数,失败列表打到 stderr。
- 下载是读操作不做 y/N 确认;playlist download 开始前打印总数并需 `--yes` 或 TTY 确认(大量写盘,沿用写操作确认体系)。

### 播放(song play)

- 依赖:`github.com/gopxl/beep/v2`(faiface/beep 维护分支)及其 mp3/flac 子包;音频输出为 oto v2(macOS/Linux/Windows 通吃)。
- 流式播放:`song url` 拿地址 → HTTP GET 响应体直接喂 `mp3.Decode`/`flac.Decode`(流式,不落盘);前置缓冲 goroutine,凑够 ~5s 水位才起播,播放中水位低自动暂停续缓冲,抗弱网抖动。
- 控制:键盘监听 goroutine(x/term 原始模式),空格=暂停/继续、←/→=∓10s、↑/↓=音量±、q=停止退出;seek 对纯流不可行,采用「暂停→按目标位置重建 HTTP Range 请求→重新解码」实现。
- 非 TTY(stdin 非终端)→ ErrUsage(退出码 2),沿用退出码规范。
- `internal/cli/player` 定义 `Player` 接口:Load(url)/Play/Pause/Seek/Volume/Progress/State/Close;beep 实现为第一个后端;接口是播放 seam,测试用 fake 验证命令层。

### 歌词(song play --lyric)

- `song lyric` 已有接口返回 LRC 文本;解析 `[mm:ss.xx]` 时间轴为 `[]TimedLine` 纯函数(lrc seam)。
- 播放中按 Player.Progress 轮询(200ms),当前行高亮前缀 `> `、上下文各一行跟随打印;无歌词时静默不显示。
- `--lyric` 在 TTY 才生效,非 TTY 报错(--json 歌词走 `song lyric` 原命令,不受影响)。

### 与输出层的关系

- 播放控制界面属"交互界面"而非结果输出,不经渲染层;下载完成输出走渲染层(键值对:文件/大小/时长)。
- 进度类打印(缓冲中、下载进度)走 stderr。

## Interface Spec(界面规格)

> 本节是产品经理视角的界面与操作性规范,落实 Implementation Decisions 的技术决策。进度反馈参照 Evil Martians《CLI UX best practices: 3 patterns》——X-of-Y 优先于 spinner,spinner 优先于光标闪烁。

### song download 界面

**启动**(单曲,读操作不确认):
```
$ musicctl song download --id 347230
```

**进行中**(stderr,X-of-Y 字节数 + 进度条 + 速度 + ETA):
```
下载 Beyond - 海阔天空.mp3
[████████████░░░░░░░░] 2.1 / 3.4 MB  (62%)  速度 1.8 MB/s  ETA 0:01
```

**完成**(stdout,走渲染层 key-value,可被 `--json` 序列化):
```
文件     Beyond - 海阔天空.mp3
目录     /Users/me/Music
大小     3.4 MB
时长     05:23
格式     mp3 (320 kbps)
元数据   ✓ 标题 / 艺人 / 专辑 / 封面
```

**跳过**(已存在无 `--force`):exit 0,stdout 一行 `已跳过(已存在):Beyond - 海阔天空.mp3`

**Flag 规格:**

| Flag | 默认 | 作用 |
|---|---|---|
| `--id int64` | 必填 | 歌曲ID;支持位置参数 `song download 347230`(见可发现性 Phase E) |
| `--level int` | 1 | 1=standard 2=exhigh 3=lossless 4=hires |
| `--out string` | `.` | 下载目录,自动 mkdir -p |
| `--force` | false | 覆盖已存在文件 |
| `--no-metadata` | false | 跳过元数据写入(纯流式落盘,快) |
| `--filename string` | `"{artist} - {title}.{ext}"` | 文件名模板,支持 `{artist}/{title}/{album}/{id}` |
| `--dry-run` | false | 只打印将下载到哪、文件名、预估大小,不落盘 |

**错误场景(全部 exit 1,除非标注):**

| 场景 | 输出 |
|---|---|
| 无版权 / VIP 限定 | `✗ 歌曲 347230 无可用音源(level=1)。尝试 --level 1 或登录 VIP 账号。` |
| `--out` 不可写 | `✗ 目录 /foo/bar 不可写:权限不足` |
| 网络中断(下载中) | 保留 `.part` 文件,`✗ 下载中断,部分文件已保存为 xxx.mp3.part,重跑可续传` |
| 元数据写入失败 | stderr 警告 `⚠ 元数据写入失败,文件已保存`,**exit 0**(不阻塞主流程) |
| 无歌词资源 | 静默,不报错 |

**关键决策**:元数据失败不阻塞——用户要的是文件,元数据是锦上添花。与「单首失败不中断」的批量语义一致。

### song play 界面(含 --lyric)

播放是**长时交互**,不是一次性命令——按迷你 TUI 设计。

**默认播放界面(TTY)**,启动后清屏一次,常驻单行状态栏:
```
▶ Beyond - 海阔天空 · 海阔天空(1993)              03:24 ━━━━━╸━━━━━ 05:23  🔊 ━━━━━━╸ 75%
 空格 暂停 · ← → ∓10s · ↑ ↓ 音量 · q 退出 · ? 帮助
```

字段:`▶`播放/`⏸`暂停/`⏳`缓冲中(水位可见);歌名·专辑(年份);当前位置━进度条━总时长;🔊━音量条(0-100%)。

**`--lyric` 模式(TTY)**,歌词区双行上下文 + 当前行高亮,状态栏不消失:
```
♪ Beyond - 海阔天空                                03:24 ━━━━━╸━━━━━ 05:23  🔊 75%

    原谅我这一生不羁放纵爱自由
  > 也会怕有一天会跌倒
    背弃了理想 谁人都可以

 空格 暂停 · ← → ∓10s · ↑ ↓ 音量 · q 退出 · ? 帮助
```

无歌词 → 状态栏正常显示,歌词区不出现(不留空白行)。`word-lyric`(逐字)暂不接入,留作增强。

**键位规格(参照 go-musicfox,极简版):**

| 键 | 动作 | 理由 |
|---|---|---|
| `Space` | 播放/暂停 | 全球通用 |
| `←` / `→` | ∓10s | Implementation Decisions 既定 |
| `Shift+←` / `Shift+→` | ∓30s | 长曲(10min+)导航必备 |
| `↑` / `↓` | 音量 ±5% | Implementation Decisions 既定 |
| `m` | 静音切换 | 静音是高频操作,不该按 ↑↓ 几次 |
| `0`-`9` | 跳到 N×10% 位置 | vim/mpv 通用约定,seek 快捷方式 |
| `?` | 切换完整键位帮助浮层 | 可发现性兜底 |
| `i` | 切换歌曲详情(艺人/专辑/URL/level) | debug + 信息查询 |
| `q` / `Esc` | 退出 | Implementation Decisions 既定;补 Esc 兜底 |

**不做的键**:prev/next(`[`/`]`)、like(`,`)、trash(`.`)——队列语义,TUI 阶段(Phase D)才需要。本 PRD 明确「单曲播放,不引入队列」。

**启动序列(缓冲可视化):**
```
$ musicctl song play --id 347230
解析音源... ✓ level=1 mp3 320kbps
缓冲中 ⠼ 4.2s / 5s
```
缓冲到 5s 水位 → 切到常驻状态栏。这一步用 spinner(单任务、短时、无精确进度),用 `⠼⠹⠸⠼⠴⠦⠧⠇⠏` 转圈,不需要假百分比。

**非 TTY 行为**:stdin 非 TTY → ErrUsage(exit 2),`播放命令需要交互式终端,请直接运行而非管道`。`--json` 不影响(播放不是数据输出,`--json` 时 exit 2 提示不支持)。

**Flag 规格:**

| Flag | 默认 | 作用 |
|---|---|---|
| `--id int64` | 必填 | 歌曲ID;支持位置参数 `song play 347230` |
| `--level int` | 1 | 音质 |
| `--lyric` | false | 启用歌词跟随 |
| `--volume int` | 75 | 启动音量 0-100 |
| `--start string` | "0" | 起始位置,格式 `mm:ss` 或秒数 |

**错误场景:**

| 场景 | 输出 | exit |
|---|---|---|
| 无音频设备(headless / 容器) | `✗ 无法初始化音频输出(beep):<详情>。headless 环境请用 song download。` | 1 |
| 音源 URL 拿不到 | `✗ 无可用音源。--level 1 试试或检查登录状态。` | 1 |
| 非 TTY | `播放命令需要交互式终端` | 2 |
| `--json` | `播放命令不支持 --json(交互命令)` | 2 |
| 播放中网络断流 | 自动重建 Range 请求一次,失败 → `✗ 网络中断,已停止` | 1 |
| `--lyric` 但无歌词 | 静默降级为无歌词模式,stderr `⚠ 该歌曲暂无歌词` | 0 |

### playlist download 界面

**X-of-Y + 多进度条** 经典场景(worker=3 → 3 条子进度条 + 1 条总进度条)。

**启动确认**(写盘量级,需 y/N):
```
$ musicctl playlist download --id 12345
歌单「我喜欢的音乐」共 286 首
  目标目录:/Users/me/Music
  默认音质:level 1 (standard)  [可用 --level 调整]
  已存在将跳过(用 --force 覆盖)
预估总量:约 1.2 GB

⚠ 即将下载 286 首歌曲
输入 y 确认,其他取消:
```

非 TTY 无 `--yes` → exit 2(沿用 `ConfirmFatal`)。

**进行中(多进度条):**
```
总进度 [████████░░░░░░░░░░░░░░░] 78 / 286  (27%)  ETA 6m12s  速度 2.4 MB/s
  ─────────────────────────────────────────
  ✓ Beyond - 海阔天空              3.4 MB
  ✓ 周杰伦 - 晴天                  4.1 MB
  ⠼ 陈奕迅 - 浮夸                  [██████░░░░] 1.8 / 4.5 MB
  · 田馥甄 - 小幸运                等待中
```

四行语义:已完成 `✓`+大小;进行中 spinner+子进度;排队 `·`。完成项滚动消失(只留最近 2-3 行)。

**完成汇总(stdout,走渲染层):**
```
歌单下载完成:我喜欢的音乐

成功     263
跳过     12 (已存在)
失败     11

失败列表(详见 stderr):
  - 347230  无可用音源(VIP)
  - 18240   网络超时
  ...
```

失败列表走 stderr,主汇总走 stdout——脚本 `playlist download ... | jq .success` 直接拿到结构化结果。

**Flag 规格:**

| Flag | 默认 | 作用 |
|---|---|---|
| `--id int64` | 必填 | 歌单ID;支持位置参数 `playlist download 12345` |
| `--level int` | 1 | 批量音质(flac 默认不上,体积太大) |
| `--out string` | `.` | 下载目录 |
| `--workers int` | 3 | 并发数,可调 1-5 |
| `--force` | false | 覆盖已存在 |
| `--dry-run` | false | 只打印清单 + 预估总量,不落盘 |
| `--filter string` | "" | 简单过滤(`artist:周杰伦`/`min-duration:60`/`available-only`),不支持 AND/OR |
| `--yes` | false | 跳过 y/N 确认 |

**断点续传语义(澄清「已存在跳过 = 续传」):**

1. **同名 + 大小匹配**(差值 < 1KB,允许 ID3 tag 微调)→ 跳过
2. **同名但大小不符** → 默认跳过,stderr `⚠ 大小不符,疑似上次中断。--force 覆盖。`
3. **存在 `.part` 文件** → 自动续传(HTTP Range,从当前字节继续)
4. **完全不存在** → 新下载

**文件名冲突处理:**
1. 默认 `{artist} - {title}.{ext}`
2. 冲突 → `{artist} - {title} ({id}).{ext}`(用 ID 兜底,稳定且可重跑)
3. `--filename "{title} - {id}"` 自定义

不自动加 `(2)` `(3)`——不可重跑,破坏幂等。

**`--json` 输出 schema:**

| 命令 | `--json` 输出 |
|---|---|
| `song download` | `{"path":"...","size":...,"duration":...,"format":"mp3","level":1,"metadata_written":true}` |
| `song play` | **不支持 `--json`**(交互命令,exit 2) |
| `playlist download` | `{"total":286,"success":263,"skipped":12,"failed":[{"id":...,"reason":"..."}]}` |

## Operability(便捷性增强)

> 与可发现性 Phase E 协同。以下增强不阻塞 Phase C 首发,但建议同期落地。

- **位置参数**:`song download 347230` / `song play 347230` / `playlist download 12345` 等价 `--id`,对齐 git/kubectl。详见可发现性 Phase E「位置参数」术语。
- **`--dry-run` 全覆盖**:`song download --dry-run` 打印「将下载到 X,文件名 Y,预估大小 Z」;`playlist download --dry-run` 打印清单 + 预估总量。CI 脚本和首次使用必备,零成本实现。
- **退出码与 jq 一致性**:`--json` 模式下 stdout 必须是单一 JSON 对象,不混提示行。见上方 schema 表。
- **风控友好**:
  1. worker 间 sleep 200-500ms 随机抖动
  2. 连续 3 次 4xx/fetch 失败 → 自动降并发到 1,再失败 → 停止并打印「疑似被限流,请稍后重试或减少 --workers」
  3. 不做自动重试风暴(Implementation Decisions 既定)

## Testing Decisions

- **lrc 解析纯函数**:多时间戳行、毫秒两位/三位、无时间戳行跳过、空文件——golden 测试(seam 1)。
- **Player 接口**:fake 实现验证命令层(play 的 Load/键盘映射/退出码),beep 后端不做单元测试(音频硬件依赖,真机验收)(seam 2)。
- **下载元数据**:tag 写入用内存 buffer 验证标题/艺人/封面正确(seam 3);文件名清洗纯函数单测。
- **批量下载**:worker 池逻辑用 fake fetcher 测并发上限、跳过、失败汇总。
- **真机 smoke**:`song download` 出文件且 macOS 可播;`song play` 出声、控制键生效;`--lyric` 歌词跟随;`playlist download` 重跑全跳过。

## Acceptance Checklist(验收清单)

### song download
- [ ] `--id` 必填校验,缺失 exit 2;支持位置参数 `song download 347230`
- [ ] 默认 level=1,文件名 `{首艺人} - {歌名}.{ext}`,路径分隔符过滤
- [ ] 元数据:标题/艺人/专辑/封面写入成功(mp3 ID3v2 + flac vorbis comment 双验证)
- [ ] `--out` 自动 mkdir -p;不可写 exit 1 带原因
- [ ] 同名跳过,`--force` 覆盖;`.part` 文件可续传
- [ ] 进度条 X-of-Y 字节数 + 速度 + ETA,完成切 `✓`
- [ ] 完成输出走渲染层,`--json` 输出符合 schema 表
- [ ] 元数据失败不阻塞,stderr 警告,exit 0
- [ ] `--dry-run` 打印目标路径/文件名/预估大小,不落盘

### song play
- [ ] beep v2 + oto v2,mp3/flac 双解码
- [ ] 5s 水位缓冲,缓冲中显示 `⏳`,不卡顿弱网(模拟限速验证)
- [ ] 键位:Space/←→/Shift←→/↑↓/m/0-9/?/i/q/Esc 全部生效
- [ ] 状态栏常驻单行,字段齐全(歌名/专辑/位置/进度/音量)
- [ ] `--lyric`:当前行高亮,上下文各 1 行;无歌词静默降级
- [ ] 非 TTY → exit 2;`--json` → exit 2 提示不支持
- [ ] 音频设备初始化失败 → exit 1 带可操作提示
- [ ] seek 通过「暂停→Range 请求→重解码」实现,≤300ms 切换无爆音
- [ ] 支持位置参数 `song play 347230`

### playlist download
- [ ] 开始前打印总数 + 预估大小,y/N 确认;`--yes` 直通;非 TTY 无 `--yes` exit 2
- [ ] worker 池并发上限可验证(fake fetcher 测 `--workers` 边界)
- [ ] 多进度条:总进度 + 当前 N 个 worker,完成项滚动消失
- [ ] 跳过规则:同名+大小匹配 / `.part` 续传 / 大小不符提示 `--force`
- [ ] 文件名冲突用 `({id})` 兜底,可重跑
- [ ] 汇总:stdout 走渲染层(success/skipped/failed),失败详情走 stderr
- [ ] `--dry-run` 只打印清单 + 预估总量不落盘
- [ ] 连续失败降并发,触发限流提示
- [ ] `--json` 输出符合 schema 表
- [ ] 支持位置参数 `playlist download 12345`

### Player seam
- [ ] `internal/cli/player.Player` 接口:Load/Play/Pause/Seek/Volume/Progress/State/Close
- [ ] beep 为第一个实现,不做单测(音频硬件依赖)
- [ ] fake 实现验证命令层:Load 调用 / 键盘映射 / 退出码 / 状态查询
- [ ] lrc 解析纯函数:多时间戳 / 毫秒 2-3 位 / 无时间戳跳过 / 空文件 golden 测试

## Out of Scope

- TUI 全屏播放器、队列/歌单连续播放(Phase D;Player 接口预留)
- 外部 mpv/afplay 播放后端(已定案内嵌 beep)
- 下载视频的 MV、播客/电台资源(接口未覆盖)
- 歌词翻译/罗马音合并显示(接口数据已有,后续增强)
- 下载目录写入 config.toml 默认(Phase B 配置后接入)

## Further Notes

- 网易云的 URL 带时效签名,播放/下载都现取现用,不做 URL 缓存。
- flac 无损体积大(30MB+/首),playlist download 的默认 level 用 1(标准),用户显式 `--level` 提音质。
- 风控注意:短时间大批量下载可能触发网易云限流,worker 并发压到 3 且不加自动重试风暴(失败一次跳过)。
