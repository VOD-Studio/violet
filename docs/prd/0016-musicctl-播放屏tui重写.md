# PRD: musicctl 播放屏 TUI 重写(Phase D 第一步)

> 状态:📋 待实现
> 关联:[CONTEXT.md musicctl CLI 段](../../CONTEXT.md)、[roadmap Phase D](../../mimo-music/docs/musicctl-roadmap.md)、[PRD-0013 实用功能](./0013-musicctl-实用功能.md)(播放/歌词原始规格,本 PRD 取代其播放屏 UI 部分)、[ADR: mimo-music-play-screen-bubbletea](../adr/mimo-music-play-screen-bubbletea.md)(supersede Phase D 小验证步骤)
> 范围:`song play` 的播放界面从手写 ANSI 状态栏重写为 bubbletea v2 全屏 TUI(封面取色/歌词舞台/弹簧动画),新建 `internal/tui` 包。**单曲播放范围不变**;浏览/队列/菜单仍属 Phase D 第二步,单独立项。

## Problem Statement

1. **手写 ANSI 维护成本高**:`play.go`(~24KB)内 playUI/statusRenderer/keyloop/csiComplete/readKey 手动维护光标序列、行重写 diff、CSI 键位解析,渲染与状态耦合——改样式=改终端字节序列,文件中大量篇幅是终端字节管理而非播放语义。
2. **视觉形态到顶**:状态栏 + 3 行静态歌词面板,无颜色/边框/布局抽象,信息密度低。owner 明确「不需要现在的这种界面」,期望 charm.land 设计语言的全屏形态。
3. **roadmap 原路径失效**:Phase D 第一步「bubbletea 列表选择器小验证」不解决播放屏本身是手写 ANSI 的核心痛点;直接重写播放屏可一并完成技术栈验证(ADR 已记录 supersede)。

## Solution

用 bubbletea v2 + lipgloss + harmonica + bubbles 重写播放屏,alt-screen 全屏形态:

```
┌────────────────────────────────────────────────────┐
│ ♪ 艺人 - 歌名 · 专辑(年份)              flac 24bit │  顶栏:标题 + 音质徽章
│                                                    │
│ ┌────────────┐    上一行歌词(向上渐暗)             │
│ │            │  ▶ 当前行歌词(高亮·弹簧滑入)        │  中央:封面 + 歌词舞台
│ │  封面       │    下一行歌词(向下渐暗)            │
│ │(kitty/iterm2)│                                   │
│ └────────────┘                                    │
│                                                    │
│ ━━━━━━━━━━━●━━━━━━━━━━━━━━  01:23 / 03:45         │  渐变进度条(封面取色)
│ 🔊 ▓▓▓▓░ 62%   空格 ⏯ · ←→ 10s · m 静音 · q 退出   │  底部:音量 + 键位栏
└────────────────────────────────────────────────────┘
```

四个亮点(按性价比排序,均已在访谈中确认进本次范围):

1. **封面取色主题**:专辑封面提取主色对,进度条渐变/歌词高亮/边框色随每首歌变化;无封面用默认调色板(Charm 紫粉渐变)。
2. **歌词舞台弹簧滚动**:当前行固定视觉中心、上下行渐暗,换行用 harmonica 弹簧滑入;歌词**默认展示**,`--no-lyric` 关闭(原 `--lyric` flag 删除)。
3. **封面可见**:渐进增强协议矩阵(参考 oh-my-pi 实现):Kitty 图形协议(ghostty/kitty 高清)→ iTerm2 inline → 半块字符画降级(▀,任意 truecolor 终端)。
4. **浮层弹簧弹出**:音量/notice 浮层弹簧入场、自动淡出;help/info 改居中 styled popup。

## User Stories

1. 作为用户,播放屏是全屏应用形态(alt-screen),退出后原终端内容完好恢复,不留残影。
2. 作为用户,每首歌的界面主色随专辑封面变化,视觉上「这首歌有这首歌的样子」。
3. 作为 ghostty/kitty 用户,能在界面中看到高清专辑封面。
4. 作为 tmux/ssh/其他终端用户,封面自动降级为半块字符画,无需任何配置。
5. 作为用户,歌词默认展示,当前行居中高亮,换行时平滑弹簧滚动,而非静态 3 行面板。
6. 作为用户,歌曲无歌词时界面不留空白面板,封面居中放大填充视觉区。
7. 作为用户,可用 `--no-lyric` 关闭歌词拉取与舞台。
8. 作为老用户,全部键位与旧状态栏一致(空格/←→/↑↓/m/0-9/?/i/q),无需重学。
9. 作为用户,按音量/静音键时浮层从底部弹簧弹出,1.5s 无操作自动淡出。
10. 作为用户,缓冲阶段仍能看到水位填充进度(StateBuffering 语义不变)。
11. 作为脚本作者,非 TTY 与 `--json` 依旧被拒绝,管道消费行为不变。
12. 作为维护者,播放屏代码位于 `internal/tui`,与命令层解耦,Phase D 第二步全屏播放器可复用该包。

## Implementation Decisions

### 包结构与装配

- 新建 `internal/tui`:播放屏 model(Init/Update/View 纯化)+ 子组件(封面渲染器、取色器、歌词舞台、进度条、浮层)。该包是 Phase D 第二步全屏播放器的生长点。
- `internal/cli/song/play.go` **保留**:flag 解析、TTY/`--json` 守卫、音源解析、缓冲 goroutine、beep 装配、歌词拉取。**删除**:playUI、statusRenderer、keyloop、csiComplete、readKey、statusLines/lyricPanel/helpLines/infoLines(手写 ANSI 全部,语义迁入 tui 包改写)。
- play.go 末端把 `(player.Player, song, songURL, lyric, level, vol)` 打包交给 `tui.Run(...)`,由 tea.Program 接管终端,返回 error 向上传播。
- `player.Player` 接口不变(Play/Pause/Seek/Volume/Progress/State)——TUI 只消费接口,与 beep 实现解耦(沿 CLI 设计文档第 3 条既定方向)。

### 依赖选型

- **bubbletea v2**(charmbracelet 自家 crush 生产环境同款;v2 渲染管线对外部图像转义序列共存更友好)、**lipgloss**(样式/布局)、**harmonica**(弹簧动画)、**bubbles/progress**(渐变进度条)。
- 图像解码用标准库 `image/jpeg`/`image/png`(封面仅 jpg/png,与 songdl MIME 嗅探同款);**不引第三方缩放库**——半块路径最近邻采样即可,Kitty 路径原图传输由协议端缩放。
- `go get` 锁定当时最新 minor;go.mod/go.sum 单独一次提交。

### 封面渲染(协议矩阵,参考 oh-my-pi 实现)

架构对齐 oh-my-pi 的图片子系统(`packages/tui/src/kitty-graphics.ts` / `terminal-capabilities.ts` / `crates/pi-natives/src/sixel.rs`),核心规则照搬:**transmit-once, place-many**。

- **数据**:`Album.PicUrl`(song detail 已返回,零新增 API 请求)→ http.Get 带 Referer/UA(沿 song url 下载同款 header)→ 解码一次,同时喂渲染与取色。
- **协议矩阵**(优先级从高到低):
  1. **Kitty**(ghostty/kitty):加载时经 tea.Cmd **一次性传输** base64(`a=t`,分配 image id);View 行只含 placement(`a=p` + id)或 Unicode placeholder(ghostty/kitty 默认,oh-my-pi 同款)——**View 输出永远不含 base64**,帧循环零图像开销。退出/换歌时 `a=d,d=i` 按 id 删除。
  2. **iTerm2 inline**(OSC 1337):图像转义作为静态行内容嵌入 View;bubbletea 行 diff 对未变化行不重发,天然实现 transmit-once。
  3. **半块字符画**:U+2580 `▀`(fg=上像素,bg=下像素,2 像素/单元格),封面区约 20×10 单元格,最近邻采样。
- **检测**:纯环境变量(快路径,**不做 query-response 探测**——避免启动阻塞;漏检的代价只是降级,cosmetic 而非 corrupting):`TERM=xterm-kitty`/`xterm-ghostty`/`KITTY_WINDOW_ID` → kitty;`TERM_PROGRAM=iTerm.app`/`WEZTERM_EXECUTABLE` → iterm2;其余 → 半块。**env 覆盖**:`MUSICCTL_IMAGE_PROTOCOL=kitty|iterm2|halfblock|off`(对齐 oh-my-pi `PI_FORCE_IMAGE_PROTOCOL` 的逃生门)。
- **高度保持 fallback**:三种渲染占用同一封面 rect,协议降级/切换不改变布局行数,不回溯重排(oh-my-pi 的 height-preserving 规则)。
- **ImageBudget**:单曲播放屏同时只需 1 张 live 图;换歌(Phase D 后续)先按 id 删旧图再传新图,不累积像素内存。
- **失败兜底**:拉取失败/无 PicUrl → 封面区显示占位(♪ 居中 + 默认调色板边框),取色同步用默认调色板。
- tmux/ssh 下 Kitty 探测自然失败 → 自动落半块,零用户配置。

### 封面取色主题

- 算法:解码图缩至 8×8 → 逐像素转 HSL → 过滤 L<0.15 / L>0.92 / S<0.2 像素 → 剩余中按 S×(1-|L-0.5|×2) 取最高分为主色;第二色要求色相距离 ≥60°,不满足则单色渐变。
- 应用面:进度条渐变(主→强调)、当前行歌词高亮、边框色、音量条填充。
- 默认调色板(常量):Charm 紫粉渐变 `#7D56F4 → #EE6FF8`。
- 取色是纯函数 `image.Image → Palette`,启动时算一次,**不进帧循环**。

### 歌词舞台与动画

- 歌词拉取链路沿现状(原 `--lyric` 的 fetch + SortedLRC + currentLyricIndex 二分),仅默认改为开。原 `--lyric` flag **删除**,新增 `--no-lyric` 关闭(工具未发布,不做 flag 兼容)。
- 舞台视口 5 行:上 2 渐暗、当前行(取色高亮 + bold)、下 2 渐暗——比原 3 行面板多一行上下文。换行时 harmonica 弹簧驱动垂直位移滑入。
- 无歌词(接口失败/空):中央区封面居中放大一档,不留空白面板(沿 PRD-0013「无歌词不留空白行」语义);stderr 警告沿现状。
- 动画驱动:tea.Tick ~30fps 跑弹簧插值(内存态);`Player.Progress()` 采样仍按 100ms tick(沿现状 refreshEvery),不加密 Player 调用。

### 浮层

- 音量/静音键 → 底部音量浮层(弹簧入场,1.5s 无操作淡出);notice(seek 失败、歌词降级原因等)同通道,语义不变(一次性,下次按键清除)。
- `?` help、`i` info 改居中 styled popup(lipgloss border + 取色边框),内容文案沿现状。

### 行为对齐清单(不变项)

- 键位集:空格(播放/暂停)、←/→(∓10s)、Shift+←/→(∓30s)、↑/↓(音量 ±5)、m(静音)、0-9(跳 N×10%)、?(help)、i(info)、q/Esc(退出)。
- 守卫:非 TTY 报 `kit.ErrUsage`、拒绝 `--json`、`--volume` 0-100 校验、`--start` 秒数/mm:ss 解析。
- StateBuffering 时进度条位置展示水位填充(PRD-0013「缓冲中(水位可见)」)。
- stdin EOF → 退出(bubbletea input 关闭触发 Quit)。
- 终端最小尺寸:宽<40 或高<12 → 居中提示「终端窗口过小」,q 仍可退出。
- 进度类输出仍走 stderr(play 进入 TUI 前的解析/缓冲提示),stdout 保持干净。

## Testing Decisions

好测试标准:只测外部行为(键位分派语义、View 金线、降级链选择、取色结果),不测动画数值与真实终端渲染。

**Seam 1 — Model 纯化**:Init/Update/View 不直接碰 io;Player 用 mock(沿 `play_test.go` 既有 MockPlayer 先例)。键位分派测试对齐现有语义:pause/resume、seek ±10/±30、volume ±5 收敛 0-100、mute 差值语义、seekPercent(缓冲中/总时长未知跳过)、quit。

**Seam 2 — 取色纯函数**:构造合成 image(已知像素分布)断言 Palette;边界:全黑图 → 默认调色板;单色图 → 单色渐变;无色相距离达标第二色 → 单色。

**Seam 3 — 封面渲染降级链**:渲染器接口 + 探测函数注入;断言检测矩阵(env 各组合 → kitty/iterm2/半块/off)、`MUSICCTL_IMAGE_PROTOCOL` 覆盖生效、拉取失败走占位;**transmit-once 断言**:Kitty 路径 base64 只在加载 Cmd 出现一次,View 行输出不含 base64(只含 placement/placeholder);三种渲染器输出 rect 行数一致(高度保持)。

**Seam 4 — teatest 集成**:fake Player + 固定歌词驱动 Model,断言 View 含金线(标题/当前行/进度时钟/键位栏);歌词 nil 时无舞台占位行;`--no-lyric` 等价路径不拉歌词。

**不测的**:harmonica 弹簧数值(动画手感,人眼验收);真实 Kitty 转义序列在 ghostty 的渲染效果(人工 smoke);真实终端尺寸探测。

## Out of Scope

- **逐字卡拉OK(yrc)**:新增 yrc 拉取 + 逐字解析器 + 行内按字高亮,列后续增量 PRD(访谈已确认「后续」)。
- **Phase D 第二步全屏播放器**:队列/菜单/浏览/`musicctl tui` 入口/裸跑行为变更,单独立项。
- **频谱 FFT 可视化**、**sixel 图片协议**:FFT 成本与收益不成正比;sixel 需引第三方 Go 库且 ghostty 不支持,sixel-only 终端(xterm/foot)属小众,后续有真实需求再议。
- **ANSI 旧 UI flag 保留**:直接删除,工具未发布不做兼容形态(沿 CLI 重构「不做旧命令兼容别名」惯例)。
- **`--lyric` flag 保留**:直接删除,由 `--no-lyric` 取代(同上惯例)。

## Further Notes

- roadmap Phase D 第一步(列表选择器小验证)由本 PRD supersede——技术栈验证在播放屏重写中完成;roadmap 文档已同步标注,ADR 见 `mimo-music-play-screen-bubbletea.md`。
- CONTEXT.md 新增「播放屏(Play Screen)」词汇,作为本 PRD 交付物的一部分。
- 人工 smoke 清单(实现完成后):ghostty(Kitty 高清封面 + Unicode placeholder)、iTerm2(OSC 1337)、tmux 内(半块降级)、`MUSICCTL_IMAGE_PROTOCOL=off`、无封面歌曲、无歌词歌曲、终端缩放至 30×8(小尺寸提示)、`--no-lyric`、缓冲水位展示。
- 提交拆分建议(沿仓库原子性规范):① go.mod 引入 charm 栈;② `internal/tui` 取色器+测试;③ `internal/tui` 封面渲染器+测试;④ `internal/tui` 歌词舞台+浮层+model;⑤ play.go 接入 tui.Run 并删除手写 ANSI;⑥ 文档同步(CONTEXT.md/roadmap,即本文档已含)。
