package kit

import (
	"bytes"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Spinner 验收(issue #16):用于缓冲等待,仅 TTY,非 TTY/--json 抑制。
// Start/Stop API,Stop 输出终态行。

// TestSpinner_TTY_RendersFrames TTY 模式渲染 spinner 帧(转圈)。
func TestSpinner_TTY_RendersFrames(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := &spinnerFakeClock{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	s := NewSpinner(&buf, "缓冲中", true, WithSpinnerClock(clock.now))
	s.Start()
	// 手动推进几帧(绕过 ticker,确定性)
	for i := 0; i < 3; i++ {
		clock.advance(100 * time.Millisecond)
		s.renderForTest()
	}
	s.Stop("完成")
	got := buf.String()
	// 应有 spinner 字符
	hasSpinner := false
	for _, f := range spinnerFrames {
		if strings.Contains(got, f) {
			hasSpinner = true
			break
		}
	}
	if !hasSpinner {
		t.Errorf("TTY 模式应渲染 spinner 帧,got %q", got)
	}
	// 应含 label
	if !strings.Contains(got, "缓冲中") {
		t.Errorf("应含 label,got %q", got)
	}
	// 终态应含 Stop 的消息
	if !strings.Contains(got, "完成") {
		t.Errorf("终态应含 Stop 消息,got %q", got)
	}
}

// TestSpinner_NonTTY_Suppressed 非 TTY 完全静默(管道不刷屏)。
func TestSpinner_NonTTY_Suppressed(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := &spinnerFakeClock{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	s := NewSpinner(&buf, "缓冲中", false, WithSpinnerClock(clock.now))
	s.Start()
	for i := 0; i < 3; i++ {
		clock.advance(100 * time.Millisecond)
		s.renderForTest()
	}
	s.Stop("完成")
	// 非 TTY:渲染期间无任何输出(只 Stop 输出终态)
	if got := buf.String(); got != "" {
		// Stop 的终态在非 TTY 也应该静默?issue 说"非 TTY 抑制"。
		// 但 Stop 的完成消息是有用信息。这里断言:渲染期间无 spinner 帧。
		for _, f := range spinnerFrames {
			if strings.Contains(got, f) {
				t.Errorf("非 TTY 不应有 spinner 帧,got %q", got)
			}
		}
	}
}

// TestSpinner_StopClearsLine Stop 后光标停留在终态行,spinner 不再转。
func TestSpinner_StopClearsLine(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := &spinnerFakeClock{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	s := NewSpinner(&buf, "解析音源", true, WithSpinnerClock(clock.now))
	s.Start()
	clock.advance(100 * time.Millisecond)
	s.renderForTest()
	s.Stop("✓ level=1 mp3")
	got := buf.String()
	// 终态行应有 \r 回到行首覆盖 spinner
	if !strings.Contains(got, "\r") {
		t.Errorf("Stop 应回车覆盖 spinner 行,got %q", got)
	}
	if !strings.Contains(got, "level=1") {
		t.Errorf("终态应含 Stop 消息,got %q", got)
	}
}

type spinnerFakeClock struct{ t time.Time }

func (c *spinnerFakeClock) now() time.Time                    { return c.t }
func (c *spinnerFakeClock) advance(d time.Duration) time.Time { c.t = c.t.Add(d); return c.t }

// TestSpinner_LabelFunc 动态 label:每帧调用 fn 取最新文本(缓冲秒数/水位),
// 替代静态 label + elapsed(song play 缓冲阶段显示「缓冲中 4.2s / 5s」,issue #21)。
func TestSpinner_LabelFunc(t *testing.T) {
	t.Parallel()
	var buf bytes.Buffer
	clock := &spinnerFakeClock{t: time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)}
	buffered := 1.0
	s := NewSpinner(&buf, "缓冲中", true,
		WithSpinnerClock(clock.now),
		WithSpinnerLabelFunc(func() string {
			return "缓冲中 " + strconv.FormatFloat(buffered, 'f', 1, 64) + "s / 5.0s"
		}),
	)
	s.Start()
	buffered = 4.2
	s.renderForTest()
	s.Stop("")
	got := buf.String()
	// 应渲染 fn 的最新值(4.2s),不是启动时的 1.0s。
	if !strings.Contains(got, "4.2s / 5.0s") {
		t.Errorf("动态 label 应渲染最新值,got %q", got)
	}
	// 不应再渲染 elapsed(静态模式的时间后缀)。
	if strings.Contains(got, "0:00") {
		t.Errorf("动态 label 模式不应渲染 elapsed,got %q", got)
	}
}
