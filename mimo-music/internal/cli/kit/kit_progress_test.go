package kit

import (
	"bytes"
	"strings"
	"testing"
)

// Kit.NewProgress 工厂验收(issue #16):
// 接 Kit 的三态规矩——TTY 渲染、--json 完全静默、非 TTY 只终态。
// 命令层调 k.NewProgress() 即可,不用自己判断 TTY/--json。

// TestKit_NewProgress_TTY TTY 模式返回会渲染的 Progress。
func TestKit_NewProgress_TTY(t *testing.T) {
	t.Parallel()
	defer func(orig func(int) bool) { isTerminal = orig }(isTerminal)
	isTerminal = func(int) bool { return true } // stderr 是 TTY

	var buf bytes.Buffer
	k := &Kit{Err: &buf, JSON: false}
	p := k.NewProgress()
	if p == nil {
		t.Fatal("TTY 模式应返回非 nil Progress")
	}
	// 渲染一帧应有输出(spinner/进度内容)。
	b := p.AddBar(100, "test")
	b.Incr(50, p.Now())
	p.RenderForTest()
	if buf.String() == "" {
		t.Error("TTY 模式应渲染输出")
	}
}

// TestKit_NewProgress_JSON JSON 模式返回的 Progress 完全静默(连终态都不输出)。
// --json 时结果走 protojson,任何进度文本都是污染。
func TestKit_NewProgress_JSON(t *testing.T) {
	t.Parallel()
	defer func(orig func(int) bool) { isTerminal = orig }(isTerminal)
	isTerminal = func(int) bool { return true } // 即使 TTY

	var buf bytes.Buffer
	k := &Kit{Err: &buf, JSON: true}
	p := k.NewProgress()
	b := p.AddBar(100, "test")
	b.Incr(50, p.Now())
	p.RenderForTest()
	b.Complete(p.Now())
	p.RenderForTest() // 终态
	if got := buf.String(); got != "" {
		t.Errorf("JSON 模式应完全静默,got %q", got)
	}
}

// TestKit_NewProgress_NonTTY 非 TTY 模式:渲染抑制,但终态可输出。
func TestKit_NewProgress_NonTTY(t *testing.T) {
	t.Parallel()
	defer func(orig func(int) bool) { isTerminal = orig }(isTerminal)
	isTerminal = func(int) bool { return false } // stderr 非 TTY

	var buf bytes.Buffer
	k := &Kit{Err: &buf, JSON: false}
	p := k.NewProgress()
	b := p.AddBar(100, "test")
	b.Incr(50, p.Now())
	p.RenderForTest()
	// 非 TTY:Start 不启动 tick,手动 RenderForTest 在 tty=false 时也应抑制中间帧。
	// 但终态(Wait)应输出。这里测中间帧抑制:
	if strings.Contains(buf.String(), "test") {
		t.Errorf("非 TTY 中间帧应抑制,got %q", buf.String())
	}
}

// 暂时占位避免 import 未用(下面 Kit.NewProgress 实现后会用到)。
var _ = strings.Contains
