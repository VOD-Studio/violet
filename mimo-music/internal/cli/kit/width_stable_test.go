package kit

import (
	"bytes"
	"testing"
	"unicode/utf8"

	"github.com/vbauerster/mpb/v8/decor"
)

// 验证 BrailleFiller 每帧可见 cell 数严格 == AvailableWidth。
// 宽度不稳定是 mpb 闪烁/光标跳的常见根因。
func TestBrailleFiller_WidthStable(t *testing.T) {
	t.Parallel()
	const width = 40
	for _, pct := range []float64{0, 0.001, 0.1, 0.333, 0.5, 0.667, 0.9, 0.999, 1.0} {
		for _, color := range []bool{false, true} {
			for _, completed := range []bool{false, true} {
				stat := decor.Statistics{
					Total: 1000000, Current: int64(pct * 1000000),
					Completed: completed, AvailableWidth: width,
				}
				var buf bytes.Buffer
				if err := (BrailleFiller{Color: color}).Fill(&buf, stat); err != nil {
					t.Fatalf("Fill error: %v", err)
				}
				// 统计可见 cell 数:剥离 ANSI 转义后的 rune 数。
				visible := 0
				inEsc := false
				for _, r := range buf.String() {
					if r == 0x1b {
						inEsc = true
						continue
					}
					if inEsc {
						if r == 'm' {
							inEsc = false
						}
						continue
					}
					visible++
				}
				if visible != width {
					t.Errorf("pct=%.3f color=%v done=%v: visible=%d, want %d (bytes=%d, runes=%d)",
						pct, color, completed, visible, width, buf.Len(), utf8.RuneCount(buf.Bytes()))
				}
			}
		}
	}
}
