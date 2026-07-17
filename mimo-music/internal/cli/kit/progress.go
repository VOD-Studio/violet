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

// Bar 单个进度条的状态。并发安全(Progress 持有 mutex,渲染时加锁)。
type Bar struct {
	Total   int64     // 总量(字节数)
	Current int64     // 已完成量
	Label   string    // 显示名(如 "Beyond - 海阔天空")
	State   BarState  // 当前状态
	IsTotal bool      // 是否总 bar(显示 ETA 而非速度)

	startedAt  time.Time // 进入 Active 的时间(算 elapsed)
	finishedAt time.Time // 进入 Done/Failed 的时间
	ewma       float64   // 平滑后的速度(bytes/sec),α=0.4
	lastSample time.Time // 上次采样时间(EWMA 用)
	errMsg     string    // 失败时的简短信息
	eta        time.Duration // 总 bar 的预估剩余时长(由 Progress 渲染时算)
}

// Progress 多 bar 渲染器。
type Progress struct {
	out    io.Writer
	width  int  // 终端宽度(渲染时计算进度条宽度)
	color  bool // true color 开关
	tty    bool // 是否 TTY(非 TTY 抑制刷新,只输出终态)

	mu       sync.Mutex
	bars     []*Bar
	prev     []string // 上一帧各行(diff 用)
	spinner  int      // spinner 帧索引(tick 推进)
	ticker   *time.Ticker
	done     chan struct{}
	now      func() time.Time // 假时钟注入(测试确定性)
	started  bool
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

// NewProgress 创建渲染器。width 为 0 时按 80 兜底(调用方应传 term.GetSize 结果)。
func NewProgress(out io.Writer, width int, tty bool, opts ...ProgressOption) *Progress {
	if width <= 0 {
		width = 80
	}
	p := &Progress{
		out:   out,
		width: width,
		tty:   tty,
		now:   time.Now,
	}
	for _, o := range opts {
		o(p)
	}
	return p
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
	b.State = StateDone
	b.Current = b.Total
	b.finishedAt = now
}

// Fail 标记失败。
func (b *Bar) Fail(msg string, now time.Time) {
	b.State = StateFailed
	b.errMsg = msg
	b.finishedAt = now
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
			p.renderOnce()
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
	// 最终渲染(无论 TTY 与否,都输出终态)。
	p.renderOnce()
	if p.tty {
		io.WriteString(p.out, "\x1b[?25h") // 恢复光标
	}
}

// renderOnce 渲染当前状态为一帧并 diff 输出。
func (p *Progress) renderOnce() {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := p.now()
	// 推进 spinner。
	p.spinner++

	// 计算总 bar 的 ETA(若有):基于总进度 + 整体平均速度。
	totalBars := 0
	for _, b := range p.bars {
		if b.IsTotal {
			if b.Current > 0 {
				elapsed := now.Sub(b.startedAt)
				if elapsed > 0 && b.Current < b.Total {
					avgSpeed := float64(b.Current) / elapsed.Seconds()
					if avgSpeed > 0 {
						b.eta = time.Duration(float64(b.Total-b.Current)/avgSpeed) * time.Second
					}
				}
			}
			totalBars++
		}
	}
	_ = totalBars

	next := make([]string, 0, len(p.bars))
	for _, b := range p.bars {
		next = append(next, renderLine(b, p.width, p.spinner, p.color))
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
