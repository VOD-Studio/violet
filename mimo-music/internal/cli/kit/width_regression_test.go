package kit

import (
	"testing"
	"time"

	"github.com/mattn/go-runewidth"
)

// TestRenderLine_FitsTerminalWidth 回归:整行显示宽度 ≤ 终端宽度。
// 堆叠 bug 根因:内容超出终端宽度 → 自动折行 → \e[1A 只上移1行不够 → 堆叠。
// CJK label(中文歌名)之前按 rune 数算宽度,实际占2列,导致溢出。
func TestRenderLine_FitsTerminalWidth(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		bar      *Bar
		termCols int
	}{
		{
			name:     "中文歌名进行中",
			bar:      &Bar{Label: "Beyond - 海阔天空", Total: 3_400_000, Current: 1_800_000, State: StateActive, startedAt: time.Now()},
			termCols: 80,
		},
		{
			name:     "长中文歌名进行中",
			bar:      &Bar{Label: "五月天 - 志明与春娇主题曲超长版本", Total: 4_600_000, Current: 2_300_000, State: StateActive, startedAt: time.Now()},
			termCols: 100,
		},
		{
			name:     "完成态中文",
			bar:      &Bar{Label: "Beyond - 海阔天空", Total: 3_400_000, Current: 3_400_000, State: StateDone},
			termCols: 80,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			line := renderLine(tc.bar, tc.termCols, 0, false)
			w := runewidth.StringWidth(line)
			if w > tc.termCols {
				t.Errorf("整行显示宽度 %d > 终端宽度 %d,会折行堆叠:\n  %q", w, tc.termCols, line)
			}
		})
	}
}
