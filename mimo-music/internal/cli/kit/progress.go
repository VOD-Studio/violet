// Package kit 的自实现进度条渲染器。
//
// 替代 mpb:直接控制每个字节,用 diff 渲染消除闪烁、EWMA 平滑速度、
// 假时钟注入确定性测试、✓ 完成态(Evil Martians/cli.r-lib 标准)。
//
// 核心循环(学 indicatif 的 steady tick):
//   - Start() 启动 100ms ticker goroutine,每次 tick 渲染一帧
//   - 渲染 = 渲染所有 bar → 与上一帧 diff → 单次 Write(原子,无空白帧)
//   - 独立于 Incr 调用频率:即使某 bar 不增长,spinner 照转、ETA 照更新
package kit

import (
	"io"
	"strconv"
	"sync"
	"time"
)

// BarState 进度条状态。
type BarState int

const (
	StateWaiting BarState = iota // 等待中(未开始)
	StateActive                  // 进行中
	StateDone                    // 完成(✓)
	StateFailed                  // 失败(✗)
)

// Bar 单个进度条的状态。并发安全:字段由自有 mu 保护,
// 写走 Incr/Complete/Fail,渲染读走 snapshot()。
type Bar struct {
	Total   int64    // 总量(字节数)
	Current int64    // 已完成量
	Label   string   // 显示名(如 "Beyond - 海阔天空")
	State   BarState // 当前状态
	IsTotal bool     // 是否总 bar(显示 ETA 而非速度)

	mu         sync.Mutex
	startedAt  time.Time     // 进入 Active 的时间(算 elapsed)
	finishedAt time.Time     // 进入 Done/Failed 的时间
	ewma       float64       // 平滑后的速度(bytes/sec),α=0.4
	lastSample time.Time     // 上次采样时间(EWMA 用)
	errMsg     string        // 失败时的简短信息
	eta        time.Duration // 总 bar 的预估剩余时长(由 Progress 渲染时算)
}

// Progress 多 bar 渲染器。
type Progress struct {
	out   io.Writer
	width int  // 渲染宽度(= rawWidth-1,预留最后一列)
	color bool // true color 开关
	tty   bool // 是否 TTY(非 TTY 抑制刷新,只输出终态)

	mu          sync.Mutex
	rawWidth    int        // 终端实际宽度(reflow 行数估算用)
	widthDirty  bool       // 宽度刚变更:下一帧先清 reflow 残影
	widthSource func() int // 轮询式宽度源(见 WithProgressWidthSource)
	pendingRaw  int        // 去抖:候选宽度(连续稳定 N 帧才应用)
	pendingTick int        // 去抖:候选宽度已连续稳定的帧数
	bars        []*Bar
	prev        []string // 上一帧各行(diff 用)
	spinner     int      // spinner 帧索引(tick 推进)
	ticker      *time.Ticker
	done        chan struct{}
	now         func() time.Time // 假时钟注入(测试确定性)
	started     bool
}

// ProgressOption 配置 NewProgress。
type ProgressOption func(*Progress)

// WithProgressColor 启用 true color 渐变。
func WithProgressColor(c bool) ProgressOption {
	return func(p *Progress) { p.color = c }
}

// WithProgressClock 注入假时钟(测试用,保证 ETA 确定性)。
func WithProgressClock(now func() time.Time) ProgressOption {
	return func(p *Progress) { p.now = now }
}

// WithProgressWidthSource 轮询式宽度源:每帧渲染前查询终端宽度。
//
// 变化时按「去抖」处理:候选宽度连续稳定 3 帧(~300ms)才应用——
// 拖动拉伸期间冻结渲染(旧块原地不动),松手后一次性清 reflow 残影
// 并重绘。为什么不去抖不行:部分终端(如 Wave)的 winsize 更新与
// 显示层 reflow 不同步,滞后窗口内任何基于行数估算的清除都会估错,
// 留下残影(重复),且拖动时每帧整块清绘在 Electron 管线下会闪烁。
// 冻结期间 Incr/EWMA 照常累积,只是画面暂停,拖拽本就短暂。
// 传 term.GetSize 的薄封装即可,非 TTY 无需设置。
func WithProgressWidthSource(f func() int) ProgressOption {
	return func(p *Progress) { p.widthSource = f }
}

// NewProgress 创建渲染器。width 为 0 时按 80 兜底(调用方应传 term.GetSize 结果)。
//
// 渲染宽度预留最后一列(width-1):immediate-wrap 终端(Terminal.app 等)
// 在写满最后一列时立刻折行,行宽顶满会导致帧块每帧多占一行 → 逐帧抖动(闪烁);
// xterm 系 deferred-wrap 终端虽不受影响,预留一列对两类终端都安全。
func NewProgress(out io.Writer, width int, tty bool, opts ...ProgressOption) *Progress {
	raw := width
	if raw <= 0 {
		raw = 80
	}
	p := &Progress{
		out:      out,
		width:    effectiveRenderWidth(width),
		rawWidth: raw,
		tty:      tty,
		now:      time.Now,
	}
	for _, o := range opts {
		o(p)
	}
	return p
}

// effectiveRenderWidth 终端宽度 → 渲染宽度:预留最后一列(见 NewProgress 文档)。
func effectiveRenderWidth(width int) int {
	if width <= 0 {
		width = 80
	}
	width--
	if width < 10 {
		width = 10
	}
	return width
}

// SetWidth 运行期更新渲染宽度(终端拉伸响应),已 Start 时立即重绘一帧。
// 调用方负责监听 SIGWINCH 并传入新的 term.GetSize 结果;
// kit 不依赖 signal/fd,保持 io.Writer 层面的纯粹。
//
// 缩窄时支持 reflow 的终端(iTerm2/VTE/kitty/WezTerm 等)会把已绘制的
// 宽行重新折行,旧帧块行数变多,若仍按 len(prev) 上移会留残影(重复)。
// 因此置 widthDirty:下一帧按新宽度估算旧帧实际占用行数,上移 + \e[J 整块清。
// 已知取舍:不 reflow 的终端(xterm/Alacritty)缩窄时该估算会多清
// 块上方几行历史输出——重复残留与误清历史之间,选择适配多数现代终端。
func (p *Progress) SetWidth(width int) {
	raw := width
	if raw <= 0 {
		raw = 80
	}
	p.mu.Lock()
	p.width = effectiveRenderWidth(width)
	p.rawWidth = raw
	p.widthDirty = true
	started := p.started
	p.mu.Unlock()
	if started {
		p.renderOnce(false)
	}
}

// AddBar 添加一个进度条,返回引用供调用方 Incr/Complete。
// 初始状态 StateWaiting;首次 Incr 切到 StateActive。
func (p *Progress) AddBar(total int64, label string) *Bar {
	b := &Bar{Total: total, Label: label, State: StateWaiting}
	p.mu.Lock()
	p.bars = append(p.bars, b)
	p.mu.Unlock()
	return b
}

// Incr 累加进度并更新 EWMA 速度。首次 Incr 切到 Active。
func (b *Bar) Incr(n int64, now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.Current += n
	if b.State == StateWaiting {
		b.State = StateActive
		b.startedAt = now
		b.lastSample = now
		return
	}
	// EWMA:基于自上次采样的瞬时速度,平滑系数 α=0.4(约 0.5s 半衰期 @100ms tick)。
	elapsed := now.Sub(b.lastSample).Seconds()
	if elapsed > 0 {
		instant := float64(n) / elapsed
		const alpha = 0.4
		if b.ewma == 0 {
			b.ewma = instant
		} else {
			b.ewma = b.ewma*(1-alpha) + instant*alpha
		}
		b.lastSample = now
	}
}

// Complete 标记完成。
func (b *Bar) Complete(now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.State = StateDone
	b.Current = b.Total
	b.finishedAt = now
}

// Fail 标记失败。
func (b *Bar) Fail(msg string, now time.Time) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.State = StateFailed
	b.errMsg = msg
	b.finishedAt = now
}

// setEta 持锁回写 ETA(渲染时算出,供调用方/测试读取)。
func (b *Bar) setEta(d time.Duration) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.eta = d
}

// snapshot 持锁拷贝全部字段(逐字段构造,新零值锁,非复制锁)。
// 渲染只读快照,与并发的 Incr/Complete 无共享内存。
func (b *Bar) snapshot() Bar {
	b.mu.Lock()
	defer b.mu.Unlock()
	return Bar{
		Total: b.Total, Current: b.Current, Label: b.Label,
		State: b.State, IsTotal: b.IsTotal,
		startedAt: b.startedAt, finishedAt: b.finishedAt,
		ewma: b.ewma, lastSample: b.lastSample,
		errMsg: b.errMsg, eta: b.eta,
	}
}

// Start 启动 steady tick。TTY 下隐藏光标 + 启动 100ms ticker;
// 非 TTY 不启动(只在 Wait 时输出终态)。
func (p *Progress) Start() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.started || !p.tty {
		return
	}
	p.started = true
	if p.tty {
		io.WriteString(p.out, "\x1b[?25l") // 隐藏光标
	}
	p.ticker = time.NewTicker(100 * time.Millisecond)
	p.done = make(chan struct{})
	go p.tickLoop()
}

// tickLoop steady tick 主循环:每 100ms 渲染一帧,直到 done 关闭。
func (p *Progress) tickLoop() {
	for {
		select {
		case <-p.ticker.C:
			p.renderOnce(false)
		case <-p.done:
			return
		}
	}
}

// Wait 停止 tick,渲染最终帧,恢复光标。
func (p *Progress) Wait() {
	p.mu.Lock()
	if p.started {
		close(p.done)
		if p.ticker != nil {
			p.ticker.Stop()
		}
		p.started = false
	}
	p.mu.Unlock()
	// 最终渲染(final=true):无论 TTY 与否都输出终态(脚本看最终结果)。
	p.renderOnce(true)
	if p.tty {
		io.WriteString(p.out, "\x1b[?25h") // 恢复光标
	}
}

// renderOnce 渲染一帧。final=true 表示终态帧(非 TTY 也输出);
// final=false 是中间帧(非 TTY 抑制,不刷屏)。
func (p *Progress) renderOnce(final bool) {
	// 中间帧且非 TTY:抑制(管道里每帧刷屏是垃圾)。
	if !final && !p.tty {
		return
	}
	p.renderOnceInternal()
}

// RenderForTest 测试钩子:同步渲染一帧(绕过 ticker,确定性)。
// 仅供测试用,生产代码用 Start/Wait 驱动异步渲染。
// 默认按中间帧处理(final=false),测试非 TTY 抑制行为。
func (p *Progress) RenderForTest() { p.renderOnce(false) }

// Now 返回当前时钟(暴露 now 给调用方取时间戳,测试时是假时钟)。
func (p *Progress) Now() time.Time { return p.now() }

func (p *Progress) renderOnceInternal() {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 轮询宽度源(去抖):候选宽度连续稳定 3 帧才应用。
	// 拖动期间冻结渲染——不在 winsize/reflow 不同步的滞后窗口内渲染,
	// 就没有竞态残影;也避免拖动中每帧整块清绘的闪烁。
	if p.widthSource != nil {
		if raw := p.widthSource(); raw > 0 && raw != p.rawWidth {
			if raw == p.pendingRaw {
				p.pendingTick++
			} else {
				p.pendingRaw = raw
				p.pendingTick = 1
			}
			if p.pendingTick >= 3 {
				p.rawWidth = raw
				p.width = effectiveRenderWidth(raw)
				p.widthDirty = true
				p.pendingRaw = 0
				p.pendingTick = 0
			} else {
				return // 宽度未稳定:冻结本帧,旧块原地不动
			}
		} else {
			p.pendingRaw = 0
			p.pendingTick = 0
		}
	}

	now := p.now()
	// 推进 spinner。
	p.spinner++

	// 宽度刚变更(SetWidth):旧帧各行在新宽度下可能已被终端 reflow 成
	// 多行,行数 ≠ len(prev)。按 reflow 估算实际占用行数,上移 + \e[J
	// 整块清掉,再按 nil prev 全新渲染——否则上半旧行残留(重复)。
	if p.widthDirty {
		p.widthDirty = false
		rows := 0
		for _, line := range p.prev {
			w := displayWidth(line)
			if w < 1 {
				w = 1
			}
			rows += (w + p.rawWidth - 1) / p.rawWidth
		}
		if rows > 0 {
			io.WriteString(p.out, "\x1b["+strconv.Itoa(rows)+"A\x1b[J")
		}
		p.prev = nil
	}

	// 快照所有 bar(每 bar 自有锁,与并发 Incr/Complete 无竞态),
	// 之后渲染只读快照——渲染期间 worker 继续推进也不撕裂。
	snaps := make([]Bar, 0, len(p.bars))
	for _, b := range p.bars {
		snaps = append(snaps, b.snapshot())
	}

	// 计算总 bar 的 ETA(若有):基于总进度 + 整体平均速度,写在快照上;
	// 同时回写原 bar(持锁),供调用方/测试读取。
	for i := range snaps {
		b := &snaps[i]
		if b.IsTotal && b.Current > 0 && b.Current < b.Total {
			if elapsed := now.Sub(b.startedAt); elapsed > 0 {
				if avgSpeed := float64(b.Current) / elapsed.Seconds(); avgSpeed > 0 {
					b.eta = time.Duration(float64(b.Total-b.Current)/avgSpeed) * time.Second
					p.bars[i].setEta(b.eta)
				}
			}
		}
	}

	next := make([]string, 0, len(snaps))
	for i := range snaps {
		next = append(next, renderLine(&snaps[i], p.width, p.spinner, p.color))
	}

	// 非 TTY:不 diff 重绘(会刷屏),只在状态变化时输出。
	// 简化:非 TTY 由 Wait 的 renderOnce 输出终态,Start 不启动 tick,所以这里
	// 只在 TTY 下被调用。仍写入 out(diffWrite 内部处理光标)。
	diffWrite(&stringWriter{w: p.out}, p.prev, next)
	p.prev = next
}

// writeFlusher 是 diffWrite 需要的输出接口(只需 WriteString)。
type writeFlusher interface {
	WriteString(s string) (int, error)
}

// stringWriter 把 io.Writer 适配为 writeFlusher。
type stringWriter struct{ w io.Writer }

func (s *stringWriter) WriteString(str string) (int, error) {
	return s.w.Write([]byte(str))
}
