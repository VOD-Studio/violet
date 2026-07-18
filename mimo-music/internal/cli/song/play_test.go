// song play 命令层测试(issue #21)。
//
// seam:Player 接口用 fakePlayer 替身(不测 beep,音频硬件留真机 smoke);
// 键盘输入用脚本化 readKey;终端行为(makeRaw/TTY 探测)注入。
// 纯函数 seam:classifyKey / parseStart / yearOf / bar / fmtClock / statusLines。
package song

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/cli/kit"
	"github.com/VOD-Studio/mimo-music/internal/cli/player"
)

// ==================== fakePlayer(Player seam) ====================

// fakePlayer 记录方法调用序列,模拟状态机(Play→Playing,Pause→Paused)。
// Progress/State 不记录(显示循环高频读,记录会淹没断言)。
type fakePlayer struct {
	mu        sync.Mutex
	loadedURL string
	state     player.State
	curMs     int64
	totalMs   int64
	vol       int
	playErr   error // Play 返回该错误(模拟 headless 音频设备初始化失败)
	calls     []string
	closed    bool
}

func (f *fakePlayer) record(format string, args ...any) {
	f.calls = append(f.calls, fmt.Sprintf(format, args...))
}

func (f *fakePlayer) Load(url string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.loadedURL = url
	f.state = player.StateBuffering
	f.record("Load(%s)", url)
	return nil
}

func (f *fakePlayer) Play() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.record("Play")
	if f.playErr != nil {
		return f.playErr
	}
	f.state = player.StatePlaying
	return nil
}

func (f *fakePlayer) Pause() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.record("Pause")
	f.state = player.StatePaused
	return nil
}

func (f *fakePlayer) Seek(offsetSec int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.record("Seek(%d)", offsetSec)
	f.curMs += offsetSec * 1000
	if f.curMs < 0 {
		f.curMs = 0
	}
	if f.totalMs > 0 && f.curMs > f.totalMs {
		f.curMs = f.totalMs
	}
	return nil
}

func (f *fakePlayer) Volume(delta int) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.record("Volume(%d)", delta)
	f.vol = min(100, max(0, f.vol+delta))
	return nil
}

func (f *fakePlayer) Progress() (int64, int64, player.State) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.curMs, f.totalMs, f.state
}

func (f *fakePlayer) State() player.State {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.state
}

func (f *fakePlayer) Close() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.closed = true
	f.record("Close")
	return nil
}

// callsSnapshot 取调用序列副本(显示循环并发读 Progress,调用序列需锁保护)。
func (f *fakePlayer) callsSnapshot() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.calls...)
}

// scriptKeys 脚本化键盘输入:依次返回 events,耗尽后返回 io.EOF。
// 脚本必须以 keyQuit 结尾,否则事件循环不退出。
func scriptKeys(events ...keyEvent) func() (keyEvent, error) {
	var mu sync.Mutex
	i := 0
	return func() (keyEvent, error) {
		mu.Lock()
		defer mu.Unlock()
		if i >= len(events) {
			return keyEvent{}, io.EOF
		}
		ev := events[i]
		i++
		return ev, nil
	}
}

// testPlayDeps 构造测试依赖:mock 网络 + fakePlayer + 脚本键盘 + 假终端。
func testPlayDeps(p *fakePlayer, keys func() (keyEvent, error)) playDeps {
	return playDeps{
		fetchURL: func(_ context.Context, id int64, _ int) (*mmpb.SongURL, error) {
			return &mmpb.SongURL{
				Id: id, Url: "http://cdn.example.com/test.mp3",
				Bitrate: 320000, Size: 3400000, Format: "mp3",
			}, nil
		},
		fetchDetail: func(_ context.Context, id int64) (*mmpb.Song, error) {
			return &mmpb.Song{
				Id:   id,
				Name: "海阔天空",
				Artists: []*mmpb.Artist{
					{Name: "Beyond"},
				},
				Album:      &mmpb.Album{Name: "乐与怒", PublishTime: "1993-05-14"},
				DurationMs: 323000,
			}, nil
		},
		newPlayer: func(volume int) player.Player {
			p.vol = volume
			return p
		},
		stdinIsTTY:   func() bool { return true },
		makeRaw:      func() (func() error, error) { return func() error { return nil }, nil },
		readKey:      keys,
		ui:           &bytes.Buffer{},
		refreshEvery: 20 * time.Millisecond,
	}
}

// ==================== 纯函数 seam ====================

// TestClassifyKey 键位表(issue #21 / PRD 键位规格):9 类键全覆盖。
func TestClassifyKey(t *testing.T) {
	t.Parallel()
	cases := []struct {
		seq  string
		want keyEvent
	}{
		{" ", keyEvent{kind: keySpace}},
		{"\x1b[D", keyEvent{kind: keyLeft}},
		{"\x1b[C", keyEvent{kind: keyRight}},
		{"\x1b[1;2D", keyEvent{kind: keyShiftLeft}},
		{"\x1b[1;2C", keyEvent{kind: keyShiftRight}},
		{"\x1b[A", keyEvent{kind: keyUp}},
		{"\x1b[B", keyEvent{kind: keyDown}},
		{"m", keyEvent{kind: keyMute}},
		{"0", keyEvent{kind: keyDigit, digit: 0}},
		{"5", keyEvent{kind: keyDigit, digit: 5}},
		{"9", keyEvent{kind: keyDigit, digit: 9}},
		{"?", keyEvent{kind: keyHelp}},
		{"i", keyEvent{kind: keyInfo}},
		{"q", keyEvent{kind: keyQuit}},
		{"\x1b", keyEvent{kind: keyQuit}}, // Esc
		{"\x03", keyEvent{kind: keyQuit}}, // Ctrl-C(raw 模式不产生 SIGINT,映射退出)
		{"x", keyEvent{kind: keyUnknown}},
		{"", keyEvent{kind: keyUnknown}},
	}
	for _, tc := range cases {
		if got := classifyKey([]byte(tc.seq)); got != tc.want {
			t.Errorf("classifyKey(%q) = %+v, want %+v", tc.seq, got, tc.want)
		}
	}
}

// TestParseStart --start 解析:秒数或 mm:ss(PRD flag 规格)。
func TestParseStart(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in      string
		want    int64
		wantErr bool
	}{
		{"0", 0, false},
		{"90", 90, false},
		{"1:30", 90, false},
		{"05:23", 323, false},
		{"", 0, false},
		{"abc", 0, true},
		{"-5", 0, true},
		{"1:xx", 0, true},
	}
	for _, tc := range cases {
		got, err := parseStart(tc.in)
		if tc.wantErr {
			if err == nil {
				t.Errorf("parseStart(%q) 应报错,got %d", tc.in, got)
			}
			continue
		}
		if err != nil || got != tc.want {
			t.Errorf("parseStart(%q) = %d, %v; want %d", tc.in, got, err, tc.want)
		}
	}
}

// TestYearOf 专辑发行时间 → 年份。网易云原始格式:毫秒时间戳字符串或日期串。
func TestYearOf(t *testing.T) {
	t.Parallel()
	cases := []struct{ in, want string }{
		{"745574400000", "1993"}, // ms 时间戳
		{"1993-05-14", "1993"},   // 日期串
		{"1993", "1993"},         // 裸年份
		{"", ""},
		{"abc", ""},
	}
	for _, tc := range cases {
		if got := yearOf(tc.in); got != tc.want {
			t.Errorf("yearOf(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// TestBar 进度条渲染:定宽、━ 填充、╸ 头部、─ 空;total 未知全空。
func TestBar(t *testing.T) {
	t.Parallel()
	cases := []struct {
		cur, total int64
		width      int
		want       string
	}{
		{0, 100, 10, "──────────"},
		{200, 326060, 10, "──────────"}, // 起播瞬间:cur>0 不足一格(真机 panic 回归)
		{50, 100, 10, "━━━━╸─────"},
		{100, 100, 10, "━━━━━━━━━━"},
		{150, 100, 10, "━━━━━━━━━━"}, // 越界收敛
		{30, 0, 10, "──────────"},    // total 未知
	}
	for _, tc := range cases {
		if got := bar(tc.cur, tc.total, tc.width); got != tc.want {
			t.Errorf("bar(%d,%d,%d) = %q, want %q", tc.cur, tc.total, tc.width, got, tc.want)
		}
	}
}

// TestFmtClock 毫秒 → mm:ss(状态栏零填充,≥1h 用 h:mm:ss)。
func TestFmtClock(t *testing.T) {
	t.Parallel()
	cases := []struct {
		ms   int64
		want string
	}{
		{0, "00:00"},
		{90000, "01:30"},
		{323000, "05:23"},
		{3661000, "1:01:01"},
	}
	for _, tc := range cases {
		if got := fmtClock(tc.ms); got != tc.want {
			t.Errorf("fmtClock(%d) = %q, want %q", tc.ms, got, tc.want)
		}
	}
}

// TestStatusLines 状态栏字段齐全(issue 验收:艺人/歌名/专辑/年份/位置/进度/音量)。
func TestStatusLines(t *testing.T) {
	t.Parallel()
	p := &fakePlayer{state: player.StatePlaying, curMs: 90000, totalMs: 323000}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	song, _ := deps.fetchDetail(context.Background(), 1)
	songURL, _ := deps.fetchURL(context.Background(), 1, 1)
	u := &playUI{p: p, song: song, songURL: songURL, level: 1, vol: 75}

	lines := u.statusLines(90000, 323000, player.StatePlaying)
	joined := strings.Join(lines, "\n")
	for _, want := range []string{
		"▶", "Beyond - 海阔天空 · 乐与怒(1993)", "01:30", "05:23", "75%", "🔊",
		"空格 暂停", "q 退出",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("状态栏缺字段 %q:\n%s", want, joined)
		}
	}

	// 暂停/缓冲/停止图标。
	if got := u.statusLines(0, 1, player.StatePaused)[0]; !strings.Contains(got, "⏸") {
		t.Errorf("暂停应显示 ⏸,got %q", got)
	}
	if got := u.statusLines(0, 1, player.StateBuffering)[0]; !strings.Contains(got, "⏳") {
		t.Errorf("缓冲应显示 ⏳,got %q", got)
	}
	if got := u.statusLines(0, 1, player.StateStopped)[0]; !strings.Contains(got, "⏹") {
		t.Errorf("停止应显示 ⏹,got %q", got)
	}

	// 静音:🔇 + 0%。
	u.muted = true
	if got := u.statusLines(90000, 323000, player.StatePlaying)[0]; !strings.Contains(got, "🔇") || !strings.Contains(got, "0%") {
		t.Errorf("静音应显示 🔇 0%%,got %q", got)
	}
	u.muted = false

	// 帮助浮层:完整键位表。
	u.showHelp = true
	if got := strings.Join(u.statusLines(0, 1, player.StatePlaying), "\n"); !strings.Contains(got, "静音切换") {
		t.Errorf("帮助浮层应含完整键位,got %q", got)
	}
	u.showHelp = false

	// 详情浮层:艺人/专辑/URL/level。
	u.showInfo = true
	got := strings.Join(u.statusLines(0, 1, player.StatePlaying), "\n")
	for _, want := range []string{"Beyond", "乐与怒", "http://cdn.example.com/test.mp3", "level=1"} {
		if !strings.Contains(got, want) {
			t.Errorf("详情浮层缺 %q:\n%s", want, got)
		}
	}
}

// ==================== 命令层流程(fakePlayer) ====================

// TestRunPlay_NonTTY 非 TTY stdin → ErrUsage(exit 2),消息指定。
func TestRunPlay_NonTTY(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	deps.stdinIsTTY = func() bool { return false }
	err := runPlay(k, 347230, 1, 75, "0", deps)
	if !errors.Is(err, kit.ErrUsage) {
		t.Fatalf("非 TTY 应返回 ErrUsage(exit 2),got %v", err)
	}
	if !strings.Contains(err.Error(), "播放命令需要交互式终端,请直接运行而非管道") {
		t.Errorf("消息不符,got %q", err.Error())
	}
	if p.loadedURL != "" {
		t.Error("非 TTY 拒绝应在拿音源之前")
	}
}

// TestRunPlay_JSON --json → ErrUsage(exit 2),提示不支持。
func TestRunPlay_JSON(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	k.JSON = true
	p := &fakePlayer{}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	err := runPlay(k, 347230, 1, 75, "0", deps)
	if !errors.Is(err, kit.ErrUsage) {
		t.Fatalf("--json 应返回 ErrUsage(exit 2),got %v", err)
	}
	if !strings.Contains(err.Error(), "播放命令不支持 --json(交互命令)") {
		t.Errorf("消息不符,got %q", err.Error())
	}
}

// TestRunPlay_NoSource 音源 URL 为空 → exit 1 无可用音源。
func TestRunPlay_NoSource(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	deps.fetchURL = func(_ context.Context, _ int64, _ int) (*mmpb.SongURL, error) {
		return &mmpb.SongURL{}, nil
	}
	err := runPlay(k, 347230, 1, 75, "0", deps)
	if err == nil || !strings.Contains(err.Error(), "无可用音源") {
		t.Fatalf("空音源应报「无可用音源」,got %v", err)
	}
}

// TestRunPlay_LoadURLAndQuit Load 用拿到的 URL 调用;q 退出 → Close + exit 0。
func TestRunPlay_LoadURLAndQuit(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{totalMs: 323000}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	if err := runPlay(k, 347230, 1, 75, "0", deps); err != nil {
		t.Fatalf("q 退出应 exit 0,got %v", err)
	}
	if p.loadedURL != "http://cdn.example.com/test.mp3" {
		t.Errorf("Load 应用音源 URL 调用,got %q", p.loadedURL)
	}
	if !p.closed {
		t.Error("退出应 Close 播放器")
	}
	calls := p.callsSnapshot()
	if len(calls) < 3 || calls[0] != "Load(http://cdn.example.com/test.mp3)" || calls[1] != "Play" {
		t.Errorf("调用序列应以 Load → Play 开头,got %v", calls)
	}
	// 状态栏渲染过(含歌名)。
	ui, _ := deps.ui.(*bytes.Buffer)
	if !strings.Contains(ui.String(), "海阔天空") {
		t.Errorf("状态栏应渲染歌名,got %q", ui.String())
	}
}

// TestRunPlay_KeyMapping 键盘 → Player 方法映射(issue 验收:9 类键全生效)。
func TestRunPlay_KeyMapping(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{state: player.StateStopped, curMs: 90000, totalMs: 323000}
	keys := scriptKeys(
		keyEvent{kind: keySpace},           // Playing → Pause
		keyEvent{kind: keySpace},           // Paused → Play
		keyEvent{kind: keyRight},           // +10s
		keyEvent{kind: keyLeft},            // -10s
		keyEvent{kind: keyShiftRight},      // +30s
		keyEvent{kind: keyShiftLeft},       // -30s
		keyEvent{kind: keyUp},              // 75→80,Volume(+5)
		keyEvent{kind: keyDown},            // 80→75,Volume(-5)
		keyEvent{kind: keyMute},            // 静音:75→0,Volume(-75)
		keyEvent{kind: keyMute},            // 取消静音:0→75,Volume(+75)
		keyEvent{kind: keyDigit, digit: 5}, // 跳到 50%:161500-90000 → Seek(71)
		keyEvent{kind: keyHelp},            // 帮助浮层(无 Player 调用)
		keyEvent{kind: keyInfo},            // 详情浮层(无 Player 调用)
		keyEvent{kind: keyQuit},
	)
	deps := testPlayDeps(p, keys)
	if err := runPlay(k, 347230, 1, 75, "0", deps); err != nil {
		t.Fatalf("运行失败: %v", err)
	}
	want := []string{
		"Load(http://cdn.example.com/test.mp3)",
		"Play",
		"Pause",
		"Play",
		"Seek(10)",
		"Seek(-10)",
		"Seek(30)",
		"Seek(-30)",
		"Volume(5)",
		"Volume(-5)",
		"Volume(-75)",
		"Volume(75)",
		"Seek(71)",
		"Close",
	}
	got := p.callsSnapshot()
	if len(got) != len(want) {
		t.Fatalf("调用序列长度 = %d, want %d:\ngot  %v\nwant %v", len(got), len(want), got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("调用序列第 %d 项 = %q, want %q:\ngot  %v", i, got[i], want[i], got)
		}
	}
	// 帮助/详情浮层渲染过。
	ui, _ := deps.ui.(*bytes.Buffer)
	if !strings.Contains(ui.String(), "静音切换") {
		t.Errorf("帮助浮层应渲染,got %q", ui.String())
	}
}

// TestRunPlay_HeadlessPlayError 音频设备初始化失败 → exit 1 带 headless 可操作消息。
func TestRunPlay_HeadlessPlayError(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{
		playErr: errors.New("无法初始化音频输出(beep): oto: no available device; headless 环境请用 song download"),
	}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	err := runPlay(k, 347230, 1, 75, "0", deps)
	if err == nil {
		t.Fatal("headless 应返回错误")
	}
	if !strings.Contains(err.Error(), "headless 环境请用 song download") {
		t.Errorf("应含可操作提示,got %q", err.Error())
	}
	if errors.Is(err, kit.ErrUsage) {
		t.Errorf("设备失败是 exit 1,不是用法错误,got %v", err)
	}
	if !p.closed {
		t.Error("失败路径也应 Close 播放器")
	}
}

// TestRunPlay_VolumeRange --volume 越界 → ErrUsage(exit 2)。
func TestRunPlay_VolumeRange(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	if err := runPlay(k, 347230, 1, 101, "0", deps); !errors.Is(err, kit.ErrUsage) {
		t.Fatalf("--volume 101 应返回 ErrUsage,got %v", err)
	}
}

// TestRunPlay_StartSeek --start 1:00 → 起播后 Seek(60)。
func TestRunPlay_StartSeek(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{totalMs: 323000}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	if err := runPlay(k, 347230, 1, 75, "1:00", deps); err != nil {
		t.Fatalf("运行失败: %v", err)
	}
	calls := p.callsSnapshot()
	found := false
	for _, c := range calls {
		if c == "Seek(60)" {
			found = true
		}
	}
	if !found {
		t.Errorf("--start 1:00 应 Seek(60),got %v", calls)
	}
}

// TestRunPlay_BadStart --start 非法 → ErrUsage。
func TestRunPlay_BadStart(t *testing.T) {
	t.Parallel()
	k, _, _ := newTestKit()
	p := &fakePlayer{}
	deps := testPlayDeps(p, scriptKeys(keyEvent{kind: keyQuit}))
	if err := runPlay(k, 347230, 1, 75, "abc", deps); !errors.Is(err, kit.ErrUsage) {
		t.Fatalf("--start abc 应返回 ErrUsage,got %v", err)
	}
}

// ==================== 键解析器(os.Pipe 模拟终端字节流) ====================

// TestRawKeyReader_SplitEscapeSequence ESC 序列被拆成两包("\x1b[" + "C")
// 也必须组装为 →(真机 smoke 曾因此丢键,seek 不生效)。
func TestRawKeyReader_SplitEscapeSequence(t *testing.T) {
	t.Parallel()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	defer w.Close()
	readKey := newRawKeyReader(r)
	go func() {
		_, _ = w.Write([]byte("\x1b["))
		time.Sleep(10 * time.Millisecond)
		_, _ = w.Write([]byte("C"))
	}()
	ev, err := readKey()
	if err != nil {
		t.Fatalf("readKey err: %v", err)
	}
	if ev.kind != keyRight {
		t.Errorf("拆分写入 \\x1b[ + C 应解析为 keyRight,got %v", ev.kind)
	}
}

// TestRawKeyReader_LoneEsc 单独 Esc(超时无后续字节)→ 退出键。
func TestRawKeyReader_LoneEsc(t *testing.T) {
	t.Parallel()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	defer w.Close()
	readKey := newRawKeyReader(r)
	go func() { _, _ = w.Write([]byte{0x1b}) }()
	ev, err := readKey()
	if err != nil {
		t.Fatalf("readKey err: %v", err)
	}
	if ev.kind != keyQuit {
		t.Errorf("单独 Esc 应解析为 keyQuit,got %v", ev.kind)
	}
}

// TestRawKeyReader_ShiftArrow Shift+← 完整 CSI("\x1b[1;2D")一次到位。
func TestRawKeyReader_ShiftArrow(t *testing.T) {
	t.Parallel()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	defer w.Close()
	readKey := newRawKeyReader(r)
	go func() { _, _ = w.Write([]byte("\x1b[1;2D")) }()
	ev, err := readKey()
	if err != nil {
		t.Fatalf("readKey err: %v", err)
	}
	if ev.kind != keyShiftLeft {
		t.Errorf("\\x1b[1;2D 应解析为 keyShiftLeft,got %v", ev.kind)
	}
}

// TestNewPlay_Flags flag 规格:--id 必填,--level/--volume/--start 默认值。
func TestNewPlay_Flags(t *testing.T) {
	t.Parallel()
	k := kit.New()
	cmd := newPlay(k)
	if lvl, err := cmd.Flags().GetInt("level"); err != nil || lvl != 1 {
		t.Errorf("--level 默认应为 1,got %v (err %v)", lvl, err)
	}
	if vol, err := cmd.Flags().GetInt("volume"); err != nil || vol != 75 {
		t.Errorf("--volume 默认应为 75,got %v (err %v)", vol, err)
	}
	if s, err := cmd.Flags().GetString("start"); err != nil || s != "0" {
		t.Errorf("--start 默认应为 \"0\",got %q (err %v)", s, err)
	}
	// 缺 --id 执行应报必填错误。
	cmd.SetOut(io.Discard)
	cmd.SetErr(io.Discard)
	if err := cmd.Execute(); err == nil {
		t.Error("缺 --id 应报错")
	}
}
