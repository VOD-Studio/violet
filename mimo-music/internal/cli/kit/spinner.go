// Spinner 独立的不可量化等待指示器(缓冲、初始化)。
//
// 用途:进度不可量化时显示转圈(PRD-0013 行 164「缓冲中 ⠼ 4.2s / 5s」)。
// 与 Progress 的区别:Progress 管 N 个可量化 bar,Spinner 是单行不可量化等待。
//
// 三态抑制(遵 PRD-0012 输出层规矩):
//   - TTY:渲染 spinner 帧转圈到 err writer(stderr)
//   - 非 TTY(管道):完全静默,不刷屏(管道里转圈是垃圾)
//   - --json:由调用方不创建 Spinner 实现(此处不查 JSON,保持单一职责)
//
// Start/Stop API:Start 启动 tick 转圈,Stop(msg) 停止并输出终态行(覆盖 spinner)。
package kit

import (
	"fmt"
	"io"
	"sync"
	"time"
)

// Spinner 单行转圈指示器。
type Spinner struct {
	out       io.Writer
	label     string
	tty       bool
	now       func() time.Time
	mu        sync.Mutex
	frame     int
	started   bool
	ticker    *time.Ticker
	done      chan struct{}
	startedAt time.Time
}

// SpinnerOption 配置 NewSpinner。
type SpinnerOption func(*Spinner)

// WithSpinnerClock 注入假时钟(测试确定性)。
func WithSpinnerClock(now func() time.Time) SpinnerOption {
	return func(s *Spinner) { s.now = now }
}

// NewSpinner 创建转圈指示器。tty=false 时所有渲染静默(非 TTY 抑制)。
func NewSpinner(out io.Writer, label string, tty bool, opts ...SpinnerOption) *Spinner {
	s := &Spinner{out: out, label: label, tty: tty, now: time.Now}
	for _, o := range opts {
		o(s)
	}
	return s
}

// Start 启动转圈。TTY 下启动 100ms ticker;非 TTY 无操作。
func (s *Spinner) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.started || !s.tty {
		return
	}
	s.started = true
	s.startedAt = s.now()
	s.ticker = time.NewTicker(100 * time.Millisecond)
	s.done = make(chan struct{})
	// 首帧立即渲染(不等第一个 tick)。
	s.renderFrameLocked()
	go s.tickLoop()
}

func (s *Spinner) tickLoop() {
	for {
		select {
		case <-s.ticker.C:
			s.renderForTest()
		case <-s.done:
			return
		}
	}
}

// renderForTest 渲染一帧(测试钩子,生产代码由 ticker 调用)。
func (s *Spinner) renderForTest() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.started {
		return
	}
	s.renderFrameLocked()
}

// renderFrameLocked 渲染一帧(调用方持锁)。非 TTY 不输出。
func (s *Spinner) renderFrameLocked() {
	if !s.tty {
		return
	}
	s.frame++
	frame := spinnerFrames[s.frame%len(spinnerFrames)]
	elapsed := s.now().Sub(s.startedAt)
	// \r 回到行首,\x1b[K 清行,写新帧。
	fmt.Fprintf(s.out, "\r\x1b[K%s %s  %s", frame, s.label, formatDuration(elapsed))
}

// Stop 停止转圈,输出终态行(覆盖 spinner)。msg 为空则只清行。
// 非 TTY 也输出终态(完成信息有用,不像转圈是垃圾)。
func (s *Spinner) Stop(msg string) {
	s.mu.Lock()
	if s.started {
		close(s.done)
		if s.ticker != nil {
			s.ticker.Stop()
		}
		s.started = false
	}
	if s.tty {
		// 回车清行,写终态。
		fmt.Fprintf(s.out, "\r\x1b[K%s\n", msg)
	} else if msg != "" {
		// 非 TTY:转圈没渲染过,终态直接输出一行(有用的完成信息)。
		fmt.Fprintln(s.out, msg)
	}
	s.mu.Unlock()
}
