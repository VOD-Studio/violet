package kit

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

// TestRenderLine_States 各状态渲染正确。
func TestRenderLine_States(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		name string
		bar  *Bar
		want []string // 应包含的子串
		bad  []string // 不应包含的子串
	}{
		{
			name: "完成态",
			bar:  &Bar{Label: "海阔天空", Total: 3_400_000, Current: 3_400_000, State: StateDone},
			want: []string{"✓", "3.2 MB"}, // 1024 进制 3.4e6 → 3.2MiB
			bad:  []string{"⠋", "⠹", "等待中"}, // 不应有 spinner
		},
		{
			name: "失败态",
			bar:  &Bar{Label: "晴天", Total: 4_100_000, State: StateFailed, errMsg: "无音源"},
			want: []string{"✗", "无音源"},
			bad:  []string{"✓", "⠋"},
		},
		{
			name: "等待态",
			bar:  &Bar{Label: "浮夸", Total: 4_500_000, State: StateWaiting},
			want: []string{"·", "等待中"},
			bad:  []string{"⠋", "✓"},
		},
		{
			name: "进行态",
			bar:  &Bar{Label: "江南", Total: 3_600_000, Current: 1_800_000, State: StateActive, startedAt: now},
			want: []string{"50%"}, // 应有百分比
			bad:  []string{"✓", "等待中"},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			line := renderLine(tc.bar, 80, 0, false)
			for _, s := range tc.want {
				if !strings.Contains(line, s) {
					t.Errorf("want substring %q in: %q", s, line)
				}
			}
			for _, s := range tc.bad {
				if strings.Contains(line, s) {
					t.Errorf("should NOT contain %q in: %q", s, line)
				}
			}
		})
	}
}

// TestRenderLine_DoneIsStatic 完成态多次渲染内容不变(不随 spinnerIdx 变化)。
func TestRenderLine_DoneIsStatic(t *testing.T) {
	t.Parallel()
	b := &Bar{Label: "海阔天空", Total: 3_400_000, Current: 3_400_000, State: StateDone}
	first := renderLine(b, 80, 0, false)
	for i := 1; i < 10; i++ {
		if got := renderLine(b, 80, i, false); got != first {
			t.Errorf("完成态应静态,spinnerIdx=%d 时变化:\n  first=%q\n  got  =%q", i, first, got)
		}
	}
}

// TestRenderLine_DoneHasColor color=true 时完成态含绿色 ANSI。
func TestRenderLine_DoneHasColor(t *testing.T) {
	t.Parallel()
	b := &Bar{Label: "x", Total: 100, Current: 100, State: StateDone}
	line := renderLine(b, 80, 0, true)
	if !strings.Contains(line, ansiGreen) {
		t.Errorf("完成态 color=true 应含绿色 ANSI: %q", line)
	}
}

// TestDiffWrite_NoEdJ 行数不变时 diff 输出不含 \e[J(整屏清屏,闪烁根因)。
func TestDiffWrite_NoEdJ(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := &stringWriter{w: &out}
	prev := []string{"line1", "line2"}
	next := []string{"line1-updated", "line2-updated"}
	diffWrite(w, prev, next)
	got := out.String()
	if strings.Contains(got, "\x1b[J") {
		t.Errorf("diffWrite 行数不变时不应有 \\e[J(整屏清): %q", got)
	}
	// 应有光标上移 + 每行 \e[K(清行)
	if !strings.Contains(got, "\x1b[2A") {
		t.Errorf("应有光标上移 \\e[2A: %q", got)
	}
	if strings.Count(got, "\x1b[K") != 2 {
		t.Errorf("应每行一个 \\e[K(共2个), got %d", strings.Count(got, "\x1b[K"))
	}
}

// TestDiffWrite_ShrinkUsesEdJ 行数减少时才用 \e[J 清多余行(安全场景)。
func TestDiffWrite_ShrinkUsesEdJ(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	w := &stringWriter{w: &out}
	prev := []string{"a", "b", "c"}
	next := []string{"a"}
	diffWrite(w, prev, next)
	got := out.String()
	if !strings.Contains(got, "\x1b[J") {
		t.Errorf("行数减少应用 \\e[J 清多余行: %q", got)
	}
}

// TestBar_Incr_EWMA Incr 多次后 EWMA 速度 > 0(修 mpb 的 0.0b/s 问题)。
func TestBar_Incr_EWMA(t *testing.T) {
	t.Parallel()
	b := &Bar{Total: 1_000_000, Label: "x", State: StateWaiting}
	base := time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC)
	// 模拟 100ms tick 每次传 100KB
	for i := 0; i < 10; i++ {
		b.Incr(100_000, base.Add(time.Duration(i)*100*time.Millisecond))
	}
	if b.ewma <= 0 {
		t.Errorf("EWMA 应 > 0, got %f", b.ewma)
	}
	// 状态应切到 Active
	if b.State != StateActive {
		t.Errorf("Incr 后状态应 Active, got %v", b.State)
	}
}

// TestProgress_FakeClockETA 假时钟注入,ETA 可确定性断言。
func TestProgress_FakeClockETA(t *testing.T) {
	t.Parallel()
	var out bytes.Buffer
	clock := newFakeClock(time.Date(2026, 7, 18, 12, 0, 0, 0, time.UTC))
	p := NewProgress(&out, 120, true, WithProgressClock(clock.now))
	total := p.AddBar(10_000_000, "总")
	total.IsTotal = true

	// t0:首次 Incr(bar 进入 Active,startedAt=t0)
	total.Incr(0, clock.now())
	t0 := total.startedAt
	// t0+10s:再 Incr 5_000_000(半量),平均速度 5e6/10s=500KB/s
	clock.advance(10 * time.Second)
	total.Incr(5_000_000, clock.now())
	p.renderOnce()

	// ETA = 剩余 5e6 / 平均速度 500KB/s = 10s
	_ = t0
	if !strings.Contains(formatDuration(total.eta), "0:10") {
		t.Errorf("ETA 应约 0:10, got %v (%s)", total.eta, formatDuration(total.eta))
	}
}

// fakeClock 测试用假时钟,可控推进。
type fakeClock struct{ t time.Time }

func newFakeClock(start time.Time) *fakeClock { return &fakeClock{t: start} }
func (c *fakeClock) now() time.Time           { return c.t }
func (c *fakeClock) advance(d time.Duration)  { c.t = c.t.Add(d) }
