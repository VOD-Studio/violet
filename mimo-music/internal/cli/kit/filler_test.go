package kit

import (
	"strings"
	"testing"
)

// TestRenderBar_WidthStable 验证 RenderBar 每次输出的可见 cell 数严格 == width。
// 宽度不稳定是终端光标跳/闪烁的常见根因(diff 渲染依赖每行等宽)。
func TestRenderBar_WidthStable(t *testing.T) {
	t.Parallel()
	const width = 40
	for _, pct := range []float64{0, 0.001, 0.1, 0.333, 0.5, 0.667, 0.9, 0.999, 1.0} {
		for _, color := range []bool{false, true} {
			got := RenderBar(int64(pct*1e6), 1_000_000, width, color)
			if v := visibleCellCount(got); v != width {
				t.Errorf("pct=%.3f color=%v: visible=%d, want %d", pct, color, v, width)
			}
		}
	}
}

// TestRenderBar_Progression 验证进度推进时渲染内容变化(已完成段增长)。
func TestRenderBar_Progression(t *testing.T) {
	t.Parallel()
	zero := RenderBar(0, 100, 20, false)
	half := RenderBar(50, 100, 20, false)
	full := RenderBar(100, 100, 20, false)
	// 0% 应有轨道锚点(无全亮 ⣿ 之外的完成段),50% 应有约一半全亮,100% 全亮。
	if strings.Count(half, "⣿") <= strings.Count(zero, "⣿") {
		t.Error("50% should have more filled cells than 0%")
	}
	if strings.Count(full, "⣿") <= strings.Count(half, "⣿") {
		t.Error("100% should have most filled cells")
	}
	// 100% 应全部是 ⣿(无未完成轨道)。
	for _, r := range full {
		if r != '⣿' {
			t.Errorf("100%% should be all ⣿, got rune %q", r)
		}
	}
}

// TestRenderBar_ColorlessNoAnsi color=false 时输出不含 ANSI 转义(纯文本降级)。
func TestRenderBar_ColorlessNoAnsi(t *testing.T) {
	t.Parallel()
	got := RenderBar(50, 100, 20, false)
	if strings.Contains(got, "\x1b") {
		t.Errorf("color=false should have no ANSI, got %q", got)
	}
}
