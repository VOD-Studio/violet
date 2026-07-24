// song play 命令:从 flag 解析到音频输出 + 键盘控制的端到端垂直切片
// (PRD-0013 Phase C,issue #21;--lyric 是 #22,位置参数是 #24)。
//
// 流程:非 TTY/--json 拒绝 → URL(拿直链) → Detail(状态栏元数据) →
// Player.Load(后台预缓冲,spinner 显示水位) → Player.Play(起播意图) →
// 水位达标 → raw 模式 → 清屏 → 常驻状态栏 + 键盘循环 → q/Esc 退出。
//
// 播放控制界面属「交互界面」而非结果输出,不经渲染层:全部走 stderr
// (进度类输出的既定通道),stdout 保持干净。
package song

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/player"
	"github.com/VOD-Studio/mimo-music/internal/cli/recall"
	songendpoint "github.com/VOD-Studio/mimo-music/internal/netease/endpoint/song"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
)

// newPlay 构造 song play 命令。
func newPlay(k *kit.Kit) *cobra.Command {
	var id int64
	var level int
	var volume int
	var start string
	var lyric bool
	c := &cobra.Command{
		Use:   "play",
		Short: "播放歌曲(交互式,键盘控制)",
		Args:  cobra.MaximumNArgs(1), // 位置参数:song play 347230 ≡ --id 347230
		RunE: func(cmd *cobra.Command, args []string) error {
			rid, err := kit.ResolveID(id, args)
			if err != nil {
				return err
			}
			return runPlay(k, rid, level, volume, start, lyric, defaultPlayDeps(k))
		},
	}
	c.Flags().Int64Var(&id, "id", 0, "歌曲 ID")
	c.Flags().IntVar(&level, "level", 1, "音质: 1=standard 2=exhigh 3=lossless 4=hires")
	c.Flags().IntVar(&volume, "volume", 75, "启动音量 0-100")
	c.Flags().StringVar(&start, "start", "0", "起始位置(秒数或 mm:ss)")
	c.Flags().BoolVar(&lyric, "lyric", false, "播放时歌词同步滚动")
	return c
}

// playDeps 是 runPlay 的外部依赖(网络 + 播放器 + 终端 + 键盘)。
//
// 抽成可注入结构是为了命令层单测(同 downloadDeps 的社区共识):
// fakePlayer 替身 Player seam,键盘用脚本化 readKey,终端行为注入假实现。
type playDeps struct {
	fetchURL    func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error)
	fetchDetail func(ctx context.Context, id int64) (*mmpb.Song, error)
	// checkAvailable 查无音源时的不可用原因(check-available);
	// 仅空 URL 失败路径调用,为 nil 时跳过查因直接给通用文案。
	checkAvailable func(ctx context.Context, id int64) (string, error)
	// fetchLyric 拉 LRC 文本(--lyric 用)。返回空串 = 无歌词(静默降级)。
	fetchLyric func(ctx context.Context, id int64) (string, error)
	// newPlayer 按启动音量构造 Player(生产:beep 后端)。
	newPlayer func(volume int) player.Player
	// stdinIsTTY 探测 stdin 是否终端(非 TTY → exit 2)。
	stdinIsTTY func() bool
	// makeRaw 进入终端 raw 模式,返回恢复函数。
	makeRaw func() (restore func() error, err error)
	// readKey 阻塞读一个键(生产:raw 模式 stdin;测试:脚本)。
	readKey func() (keyEvent, error)
	// ui 状态栏/提示渲染输出(生产 stderr)。
	ui io.Writer
	// refreshEvery 状态栏刷新周期(PRD:约 200ms)。
	refreshEvery time.Duration
}

// defaultPlayDeps 生产依赖:真实网络(engine + endpoint)+ beep 播放器 + 真实终端。
func defaultPlayDeps(k *kit.Kit) playDeps {
	ui := k.Err
	if ui == nil {
		ui = os.Stderr
	}
	return playDeps{
		fetchURL: func(ctx context.Context, id int64, level int) (*mmpb.SongURL, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.URL, &mmpb.GetSongURLRequest{
				SongId: id, Level: mmpb.SongLevel(level),
			})
			if err != nil {
				return nil, err
			}
			return resp.Url, nil
		},
		fetchDetail: func(ctx context.Context, id int64) (*mmpb.Song, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.Detail, &mmpb.GetSongDetailRequest{SongId: id})
			if err != nil {
				return nil, err
			}
			return resp.Song, nil
		},
		checkAvailable: func(ctx context.Context, id int64) (string, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.CheckAvailable, &mmpb.CheckAvailableRequest{SongId: id})
			if err != nil {
				return "", err
			}
			if resp.Available {
				return "", nil // 可用却拿不到 URL(非版权问题)→ 不给伪原因
			}
			return resp.Message, nil
		},
		fetchLyric: func(ctx context.Context, id int64) (string, error) {
			resp, err := kit.Exec(k, ctx, songendpoint.Lyric, &mmpb.GetLyricRequest{SongId: id})
			if err != nil {
				return "", err
			}
			if resp.Lyric == nil {
				return "", nil
			}
			return resp.Lyric.Lrc, nil
		},
		newPlayer: func(volume int) player.Player {
			newReq := func(ctx context.Context, method, url string) (*http.Request, error) {
				return engine.NewNeteaseRequest(ctx, method, url, k.CurrentCookie())
			}
			return player.NewBeep(newReq, player.WithVolume(volume))
		},
		stdinIsTTY:   func() bool { return term.IsTerminal(int(os.Stdin.Fd())) },
		makeRaw:      makeRawStdin,
		readKey:      newRawKeyReader(os.Stdin),
		ui:           ui,
		refreshEvery: 200 * time.Millisecond,
	}
}

// runPlay 执行播放主流程。退出码约定:
// exit 2(ErrUsage):非 TTY / --json / flag 越界;
// exit 1:无音源 / 音频设备初始化失败 / 加载失败;
// exit 0:q/Esc 正常退出。
//
// lyric=true 时(--lyric):起播后额外拉歌词,在状态栏渲染歌词面板(issue #22)。
// 无歌词静默降级(stderr 警告),播放继续。
func runPlay(k *kit.Kit, id int64, level, volume int, start string, lyric bool, deps playDeps) error {
	// 1. 先做非 TTY 检查,再 --json(issue #21 既定顺序)。
	if !deps.stdinIsTTY() {
		return fmt.Errorf("%w:播放命令需要交互式终端,请直接运行而非管道", kit.ErrUsage)
	}
	if k.JSON {
		return fmt.Errorf("%w:播放命令不支持 --json(交互命令)", kit.ErrUsage)
	}
	if volume < 0 || volume > 100 {
		return fmt.Errorf("%w:--volume 需在 0-100 之间,got %d", kit.ErrUsage, volume)
	}
	startSec, err := parseStart(start)
	if err != nil {
		return fmt.Errorf("%w:--start %q 非法(秒数或 mm:ss)", kit.ErrUsage, start)
	}

	ctx := k.CookieCtx()

	// 2. 拿播放直链。空 → exit 1 无可用音源。
	songURL, err := deps.fetchURL(ctx, id, level)
	if err != nil {
		return fmt.Errorf("获取播放地址: %w", err)
	}
	if songURL == nil || songURL.Url == "" {
		if reason := unavailableReason(ctx, deps.checkAvailable, id); reason != "" {
			return fmt.Errorf("✗ 无可用音源: %s", reason)
		}
		return fmt.Errorf("✗ 无可用音源(level=%d)。检查登录状态或换个音质(--level)试试", level)
	}

	// 3. 歌曲详情(状态栏元数据)。失败不致命:空 Song 兜底。
	song, _ := deps.fetchDetail(ctx, id)
	if song == nil {
		song = &mmpb.Song{Id: id}
	}
	fmt.Fprintf(deps.ui, "解析音源 ✓ level=%d %s %dkbps\n", level, songURL.Format, songURL.Bitrate/1000)

	// 4. 构造播放器并加载(后台开始预缓冲)。
	p := deps.newPlayer(volume)
	defer func() { _ = p.Close() }()
	if err := p.Load(songURL.Url); err != nil {
		return fmt.Errorf("✗ 加载音源失败: %w", err)
	}

	// 5. 起播意图。音频设备初始化失败(headless/容器)→ exit 1 带可操作消息
	// (beep 的错误文本已含「headless 环境请用 song download」)。
	if err := p.Play(); err != nil {
		return fmt.Errorf("✗ %w", err)
	}

	// 6. 缓冲可视化:spinner 显示已缓冲/水位,水位达标(离开 Buffering)后停。
	waitBuffer(k, p)
	if p.State() == player.StateStopped {
		return errors.New("✗ 缓冲失败,音源不可用或网络中断")
	}

	// 7. 起始定位(失败不致命,Warnf 继续从头播)。
	if startSec > 0 {
		if err := p.Seek(startSec); err != nil {
			k.Warnf("⚠ 起始定位失败: %v", err)
		}
	}

	// 7.5. 歌词(--lyric):拉 LRC 文本 → SortedLRC(按时间轴排序,供二分查找)。
	// 失败或空歌词静默降级:stderr 警告 + 状态栏 notice(警告先于 UI 清屏打印,
	// 不进 notice 用户看不到原因),播放继续无歌词面板(PRD:无歌词不留空白行)。
	var lyricLines []player.TimedLine
	var lyricNotice string
	if lyric {
		lyricLines, lyricNotice = loadLyric(ctx, k, id, deps)
	}

	// 8. raw 模式 + 事件循环。q/Esc 退出 → 恢复终端,exit 0。
	restore, err := deps.makeRaw()
	if err != nil {
		return fmt.Errorf("✗ 终端进入原始模式失败: %w", err)
	}
	defer func() { _ = restore() }()

	u := &playUI{p: p, song: song, songURL: songURL, level: level, vol: volume, lyric: lyricLines, notice: lyricNotice}
	u.loop(deps)
	// 播放成功消费后埋点召回池(方案 c:命令显式调 kit.Record;失败不阻塞)。
	k.Record(id, songName(song), songArtist(song), recall.SrcPlay)
	return nil
}

// unavailableReason 查歌曲不可用原因(check-available):回调缺失/查询失败/
// 歌曲标记可用(非版权问题)→ 空串,调用方走通用文案。仅无音源失败路径调用。
func unavailableReason(ctx context.Context, check func(context.Context, int64) (string, error), id int64) string {
	if check == nil {
		return ""
	}
	reason, err := check(ctx, id)
	if err != nil {
		return ""
	}
	return reason
}

// songName 提取歌曲名(无则空),供召回池埋点。
func songName(s *mmpb.Song) string {
	if s == nil {
		return ""
	}
	return s.Name
}

// songArtist 提取主歌手名(取第一个艺人),供召回池埋点。
func songArtist(s *mmpb.Song) string {
	if s == nil || len(s.Artists) == 0 {
		return ""
	}
	return s.Artists[0].Name
}

// loadLyric 拉歌词并解析为按时间轴排序的 TimedLine。失败/空歌词静默降级:
// 返回 (nil, 降级原因)——调用方把原因放进状态栏 notice(stderr 的 Warnf 会被
// UI 清屏盖掉,notice 才是用户实际能看到的通道)。有歌词返回 (lines, "")。
func loadLyric(ctx context.Context, k *kit.Kit, id int64, deps playDeps) ([]player.TimedLine, string) {
	text, err := deps.fetchLyric(ctx, id)
	if err != nil {
		// 歌词接口失败不致命:.Warnf 警告,播放继续。
		k.Warnf("⚠ 歌词获取失败: %v", err)
		return nil, fmt.Sprintf("⚠ 歌词获取失败: %v", err)
	}
	lines := player.SortedLRC(text)
	if len(lines) == 0 {
		k.Warnf("⚠ 该歌曲暂无歌词")
		return nil, "⚠ 该歌曲暂无歌词"
	}
	return lines, ""
}

// waitBuffer 起播前缓冲等待:spinner 渲染「缓冲中 ⠼ 4.2s / 5s」到 stderr,
// 轮询 Player.Progress(StateBuffering 时返回已缓冲 ms / 水位 ms),离开 Buffering 返回。
func waitBuffer(k *kit.Kit, p player.Player) {
	// 状态翻离 Buffering 后 Progress 语义变为 (位置, 总时长),ticker 末帧可能
	// 赶在 Stop 前渲染出「0.0s / 326.1s」这种错位文本;记住最后的水位对,翻离后沿用。
	var lastBuf, lastMark int64 = 0, 5000
	spin := k.NewSpinner("缓冲中", kit.WithSpinnerLabelFunc(func() string {
		cur, total, st := p.Progress()
		if st == player.StateBuffering {
			lastBuf, lastMark = cur, total
		}
		cur, total = lastBuf, lastMark
		if total > 0 && cur > total {
			// 快网下已缓冲量远超水位:显示收敛到水位(58.0s / 5.0s 是坏味道)。
			cur = total
		}
		return fmt.Sprintf("缓冲中 %.1fs / %.1fs", float64(cur)/1000, float64(total)/1000)
	}))
	spin.Start()
	for p.State() == player.StateBuffering {
		time.Sleep(100 * time.Millisecond)
	}
	spin.Stop("")
}

// ==================== 键盘输入 ====================

// keyKind 键盘输入类别。
type keyKind int

const (
	keyUnknown keyKind = iota
	keySpace
	keyLeft
	keyRight
	keyShiftLeft
	keyShiftRight
	keyUp
	keyDown
	keyMute
	keyDigit
	keyHelp
	keyInfo
	keyQuit
)

// keyEvent 解析后的键盘输入。digit 仅 kind==keyDigit 时有意义(0-9)。
type keyEvent struct {
	kind  keyKind
	digit int
}

// classifyKey 字节序列 → 键事件(纯函数)。
// 方向键是 ESC 序列(xterm 编码);Shift+方向是 CSI 1;2X;单独 Esc 是裸 0x1b;
// raw 模式下 Ctrl-C 不产生 SIGINT(ISIG 关),收到 0x03 映射退出兜底。
func classifyKey(seq []byte) keyEvent {
	switch string(seq) {
	case " ":
		return keyEvent{kind: keySpace}
	case "q", "\x1b", "\x03":
		return keyEvent{kind: keyQuit}
	case "\x1b[D":
		return keyEvent{kind: keyLeft}
	case "\x1b[C":
		return keyEvent{kind: keyRight}
	case "\x1b[1;2D":
		return keyEvent{kind: keyShiftLeft}
	case "\x1b[1;2C":
		return keyEvent{kind: keyShiftRight}
	case "\x1b[A":
		return keyEvent{kind: keyUp}
	case "\x1b[B":
		return keyEvent{kind: keyDown}
	case "m":
		return keyEvent{kind: keyMute}
	case "?":
		return keyEvent{kind: keyHelp}
	case "i":
		return keyEvent{kind: keyInfo}
	}
	if len(seq) == 1 && seq[0] >= '0' && seq[0] <= '9' {
		return keyEvent{kind: keyDigit, digit: int(seq[0] - '0')}
	}
	return keyEvent{kind: keyUnknown}
}

// makeRawStdin stdin 进入 raw 模式,返回恢复函数。
func makeRawStdin() (func() error, error) {
	fd := int(os.Stdin.Fd())
	old, err := term.MakeRaw(fd)
	if err != nil {
		return nil, err
	}
	return func() error { return term.Restore(fd, old) }, nil
}

// newRawKeyReader 从 raw 模式终端读键。
//
// ESC 序列(方向键等)在流上可能被任意拆分("\x1b[" + "C"),
// 必须按 CSI 协议组装:ESC '[' 后是参数字节,直到 final byte(0x40-0x7E)。
// 单独 Esc 与序列的区分:ESC 后短超时等后续字节——序列终端一次发出立即跟上,
// 单独 Esc 没有后续。终端 fd 支持 SetReadDeadline(可轮询)。
func newRawKeyReader(f *os.File) func() (keyEvent, error) {
	one := make([]byte, 1)
	readByte := func() (byte, error) {
		_, err := io.ReadFull(f, one)
		return one[0], err
	}
	return func() (keyEvent, error) {
		b, err := readByte()
		if err != nil {
			return keyEvent{}, err
		}
		if b != 0x1b {
			return classifyKey([]byte{b}), nil
		}
		seq := []byte{0x1b}
		for len(seq) < 8 {
			_ = f.SetReadDeadline(time.Now().Add(30 * time.Millisecond))
			nb, err := readByte()
			_ = f.SetReadDeadline(time.Time{})
			if err != nil {
				break // 超时:单独 Esc(或不完整序列按现状分类)
			}
			seq = append(seq, nb)
			if len(seq) >= 2 && seq[1] != '[' {
				break // 非 CSI 序列(如 Alt+键):两字节即止
			}
			if csiComplete(seq) {
				break
			}
		}
		return classifyKey(seq), nil
	}
}

// csiComplete 报告 CSI 序列已收完:ESC '[' 参数字节 + final byte(0x40-0x7E)。
// 例:"\x1b[C"(→)、"\x1b[1;2D"(Shift+←)。
func csiComplete(seq []byte) bool {
	if len(seq) < 3 || seq[0] != 0x1b || seq[1] != '[' {
		return false
	}
	last := seq[len(seq)-1]
	return last >= 0x40 && last <= 0x7E
}

// ==================== 播放 UI ====================

// playUI 播放界面状态(单 goroutine 事件循环持有,无锁)。
type playUI struct {
	p       player.Player
	song    *mmpb.Song
	songURL *mmpb.SongURL
	level   int
	vol     int // 用户设定音量(muted 时保留,取消静音恢复)
	muted   bool

	// lyric 按时间轴排序的歌词行(nil = 无歌词,不渲染面板)。
	// 来自 --lyric 模式下的 SortedLRC;由 currentLyricIndex 二分查找当前行。
	lyric []player.TimedLine

	showHelp bool
	showInfo bool
	notice   string // 一次性提示(seek 失败、歌词降级原因等),下次按键清除
	quit     bool
}

// loop 事件循环:键盘 goroutine 喂事件 chan,主循环 select 事件 + 定时刷新。
// readKey 阻塞在 goroutine 里;quit 后该 goroutine 可能仍阻塞在 stdin 读
// (CLI 进程随即退出,可接受;测试脚本以 io.EOF 收尾,无泄漏)。
func (u *playUI) loop(deps playDeps) {
	events := make(chan keyEvent, 8)
	done := make(chan struct{})
	defer close(done)
	go func() {
		for {
			ev, err := deps.readKey()
			if err != nil {
				close(events)
				return
			}
			select {
			case events <- ev:
			case <-done:
				return
			}
		}
	}()

	_, _ = fmt.Fprint(deps.ui, "\x1b[2J\x1b[H\x1b[?25l") // 清屏一次 + 隐藏光标
	defer func() { _, _ = fmt.Fprint(deps.ui, "\x1b[?25h") }()

	r := &statusRenderer{out: deps.ui}
	render := func() {
		cur, total, st := u.p.Progress()
		r.render(u.statusLines(cur, total, st))
	}
	render()

	ticker := time.NewTicker(deps.refreshEvery)
	defer ticker.Stop()
	for !u.quit {
		select {
		case ev, ok := <-events:
			if !ok {
				// stdin 关闭(EOF):无法继续接收控制,退出。
				return
			}
			u.handleKey(ev)
			render() // 按键立即反馈,不等下一 tick
		case <-ticker.C:
			render()
		}
	}
}

// handleKey 键 → 动作分派(PRD 键位规格)。
func (u *playUI) handleKey(ev keyEvent) {
	u.notice = ""
	switch ev.kind {
	case keySpace:
		// Playing/Buffering → 暂停;Paused/Stopped(播完)→ 播放(重播)。
		if st := u.p.State(); st == player.StatePlaying || st == player.StateBuffering {
			u.do("暂停", func() error { return u.p.Pause() })
		} else {
			u.do("播放", func() error { return u.p.Play() })
		}
	case keyLeft:
		u.seek(-10)
	case keyRight:
		u.seek(10)
	case keyShiftLeft:
		u.seek(-30)
	case keyShiftRight:
		u.seek(30)
	case keyUp:
		u.adjustVolume(5)
	case keyDown:
		u.adjustVolume(-5)
	case keyMute:
		u.toggleMute()
	case keyDigit:
		u.seekPercent(ev.digit)
	case keyHelp:
		u.showHelp = !u.showHelp
		u.showInfo = false
	case keyInfo:
		u.showInfo = !u.showInfo
		u.showHelp = false
	case keyQuit:
		u.quit = true
	}
}

// do 执行 Player 操作,失败写一次性提示(状态栏展示,不打断播放)。
func (u *playUI) do(what string, fn func() error) {
	if err := fn(); err != nil {
		u.notice = fmt.Sprintf("✗ %s失败: %v", what, err)
	}
}

func (u *playUI) seek(offsetSec int64) {
	u.do("定位", func() error { return u.p.Seek(offsetSec) })
}

// seekPercent 跳到 N×10% 位置(0-9 数字键)。总时长未知或缓冲中跳过。
func (u *playUI) seekPercent(digit int) {
	cur, total, st := u.p.Progress()
	if st == player.StateBuffering || total <= 0 {
		return
	}
	target := total * int64(digit) / 10
	u.seek((target - cur) / 1000)
}

// effectiveVol 生效音量(静音时为 0;vol 保留原值供恢复)。
func (u *playUI) effectiveVol() int {
	if u.muted {
		return 0
	}
	return u.vol
}

// adjustVolume 音量 ±delta(收敛 0-100)。Player.Volume 是 delta 语义:
// 算出生效音量差值一次调用;静音中按音量键先取消静音再调整。
func (u *playUI) adjustVolume(delta int) {
	old := u.effectiveVol()
	u.vol = min(100, max(0, u.vol+delta))
	u.muted = false
	if d := u.effectiveVol() - old; d != 0 {
		u.do("音量", func() error { return u.p.Volume(d) })
	}
}

// toggleMute 静音切换(同 adjustVolume 的差值语义)。
func (u *playUI) toggleMute() {
	old := u.effectiveVol()
	u.muted = !u.muted
	if d := u.effectiveVol() - old; d != 0 {
		u.do("静音", func() error { return u.p.Volume(d) })
	}
}

// statusLines 渲染常驻状态行 + 键位提示 + 可选浮层(纯函数,可测)。
//
// StateBuffering 时 Progress 返回 (已缓冲, 水位),状态栏直接展示水位填充
// (PRD「⏳缓冲中(水位可见)」)。
//
// --lyric 且 u.lyric 非空时,在状态栏与键位提示之间插入歌词面板(PRD mockup 行 134-140):
// 空行 + 上一行 + > 当前行 + 下一行 + 空行。无歌词不插(不留空白行)。
func (u *playUI) statusLines(curMs, totalMs int64, state player.State) []string {
	volIcon := "🔊"
	if u.muted {
		volIcon = "🔇"
	}
	vol := u.effectiveVol()
	line1 := fmt.Sprintf("%s %s  %s %s %s  %s %s %d%%",
		stateIcon(state), u.title(),
		fmtClock(curMs), bar(curMs, totalMs, 10), fmtClock(totalMs),
		volIcon, bar(int64(vol), 100, 5), vol)
	lines := []string{line1}
	// 歌词面板(--lyric 模式且有歌词)。当前行 `> ` 前缀高亮,上下文各一行。
	// 无歌词(nil 或空)→ 不渲染,状态栏与键位提示紧邻。
	if len(u.lyric) > 0 {
		lines = append(lines, u.lyricPanel(curMs)...)
	}
	lines = append(lines, " 空格 暂停 · ← → ∓10s · ↑ ↓ 音量 · q 退出 · ? 帮助")
	if u.notice != "" {
		lines = append(lines, " "+u.notice)
	}
	if u.showHelp {
		lines = append(lines, helpLines()...)
	}
	if u.showInfo {
		lines = append(lines, u.infoLines()...)
	}
	return lines
}

// lyricPanel 渲染歌词面板:空行 + 上一行 + > 当前行 + 下一行 + 空行。
// 当前行用 currentLyricIndex 二分查找;首/末行时缺省的上下文行留空(保持面板 5 行稳定,
// 避免 重绘 行数 跳动)。
func (u *playUI) lyricPanel(curMs int64) []string {
	idx := currentLyricIndex(u.lyric, curMs)
	prev, cur, next := "", "", ""
	if idx > 0 {
		prev = u.lyric[idx-1].Text
	}
	cur = u.lyric[idx].Text
	if idx+1 < len(u.lyric) {
		next = u.lyric[idx+1].Text
	}
	return []string{
		"",
		"   " + prev,
		" > " + cur,
		"   " + next,
		"",
	}
}

// currentLyricIndex 二分查找 curMs 对应的当前歌词行索引。
//
// 语义:返回最大的 i,使 lyric[i].TimeMs <= curMs(即「已经唱到/正在唱的最后一行」)。
// curMs 早于首行 → 返回 0(首行高亮,等待起唱)。
// 空 lyric → 返回 0(调用方应先判空,这里防御性返回 0 避免越界)。
//
// 二分:slices.BinarySearchFunc 找到第一个 TimeMs > curMs 的位置,减 1 即当前行。
// 等价于 sort.Search 但用标准库原语,语义更清晰。
func currentLyricIndex(lyric []player.TimedLine, curMs int64) int {
	if len(lyric) == 0 {
		return 0
	}
	// 找首个 TimeMs > curMs 的索引(upper bound)。
	lo, hi := 0, len(lyric)
	for lo < hi {
		mid := (lo + hi) / 2
		if lyric[mid].TimeMs <= curMs {
			lo = mid + 1
		} else {
			hi = mid
		}
	}
	// lo 是首个 > curMs 的位置;当前行 = lo - 1。
	// lo == 0(curMs 早于所有行)→ 当前行 = 0(首行,等起唱)。
	if lo == 0 {
		return 0
	}
	return lo - 1
}

// title 状态栏标题:「艺人 - 歌名 · 专辑(年份)」。
func (u *playUI) title() string {
	name := u.song.Name
	if name == "" {
		name = strconv.FormatInt(u.song.Id, 10)
	}
	s := name
	if len(u.song.Artists) > 0 && u.song.Artists[0].Name != "" {
		s = u.song.Artists[0].Name + " - " + s
	}
	if u.song.Album != nil && u.song.Album.Name != "" {
		s += " · " + u.song.Album.Name
		if y := yearOf(u.song.Album.PublishTime); y != "" {
			s += "(" + y + ")"
		}
	}
	return s
}

// helpLines 完整键位帮助浮层(? 切换)。
func helpLines() []string {
	return []string{
		" ── 帮助 ──",
		" 空格        播放/暂停",
		" ← / →      快退/快进 10s(Shift 30s)",
		" ↑ / ↓      音量 ±5%",
		" m          静音切换",
		" 0-9        跳到 10% 刻度",
		" i          歌曲详情",
		" ?          关闭帮助",
		" q / Esc    退出",
	}
}

// infoLines 歌曲详情浮层(i 切换):艺人/专辑/URL/level。
func (u *playUI) infoLines() []string {
	album := ""
	if u.song.Album != nil {
		album = u.song.Album.Name
		if y := yearOf(u.song.Album.PublishTime); y != "" {
			album += "(" + y + ")"
		}
	}
	artist := ""
	if len(u.song.Artists) > 0 {
		artist = u.song.Artists[0].Name
	}
	return []string{
		" ── 歌曲详情 ──",
		" 艺人  " + artist,
		" 专辑  " + album,
		fmt.Sprintf(" 音质  level=%d %s %dkbps", u.level, u.songURL.Format, u.songURL.Bitrate/1000),
		" 音源  " + u.songURL.Url,
	}
}

// statusRenderer 原地重绘多行状态栏(光标上移 + \r + \x1b[K 逐行重写,
// 行数变少时 \x1b[J 清残留——同 kit diffWrite 的既定终端字节序列)。
type statusRenderer struct {
	out   io.Writer
	lines int // 上一帧行数
}

func (r *statusRenderer) render(next []string) {
	var b strings.Builder
	if r.lines > 0 {
		fmt.Fprintf(&b, "\x1b[%dA", r.lines)
	}
	for _, ln := range next {
		b.WriteString("\r\x1b[K")
		b.WriteString(ln)
		b.WriteByte('\n')
	}
	if r.lines > len(next) {
		b.WriteString("\x1b[J")
	}
	_, _ = io.WriteString(r.out, b.String())
	r.lines = len(next)
}

// ==================== 纯函数 ====================

// stateIcon 播放状态图标:▶ 播放 / ⏸ 暂停 / ⏳ 缓冲 / ⏹ 停止。
func stateIcon(s player.State) string {
	switch s {
	case player.StatePlaying:
		return "▶"
	case player.StatePaused:
		return "⏸"
	case player.StateBuffering:
		return "⏳"
	default:
		return "⏹"
	}
}

// bar 定宽进度条:━ 填充 + ╸ 头部 + ─ 空;total ≤ 0(未知)全空。
// cur 越界收敛到 [0,total]。
func bar(cur, total int64, width int) string {
	if width < 2 {
		width = 2
	}
	if total <= 0 || cur <= 0 {
		return strings.Repeat("─", width)
	}
	f := int(cur * int64(width) / total)
	if f <= 0 {
		// cur>0 但不足一格(起播瞬间):不画头部,避免负 Repeat。
		return strings.Repeat("─", width)
	}
	if f >= width {
		return strings.Repeat("━", width)
	}
	return strings.Repeat("━", f-1) + "╸" + strings.Repeat("─", width-f)
}

// fmtClock 毫秒 → mm:ss(零填充;≥1h 用 h:mm:ss)。
func fmtClock(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	total := ms / 1000
	h := total / 3600
	m := (total % 3600) / 60
	s := total % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}

// parseStart --start 解析:秒数("90")或 mm:ss("1:30")。空串当 0。
func parseStart(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0, nil
	}
	parts := strings.Split(s, ":")
	if len(parts) > 2 {
		return 0, fmt.Errorf("格式不支持: %q", s)
	}
	var sec int64
	for _, p := range parts {
		n, err := strconv.ParseInt(p, 10, 64)
		if err != nil {
			return 0, err
		}
		sec = sec*60 + n
	}
	if sec < 0 {
		return 0, fmt.Errorf("不能为负: %q", s)
	}
	return sec, nil
}

// yearOf 专辑发行时间 → 年份。网易云原始格式不一:
// 毫秒时间戳字符串("745574400000")、日期串("1993-05-14")、裸年份("1993")。
// 规则:≤4 位纯数字当年份;更长的纯数字当毫秒时间戳;含 - 取首段;其余放弃。
func yearOf(publishTime string) string {
	s := strings.TrimSpace(publishTime)
	if s == "" {
		return ""
	}
	if i := strings.IndexByte(s, '-'); i > 0 {
		s = s[:i]
	}
	if len(s) > 4 {
		ms, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			return ""
		}
		return strconv.Itoa(time.UnixMilli(ms).Year())
	}
	if _, err := strconv.Atoi(s); err != nil {
		return ""
	}
	return s
}
