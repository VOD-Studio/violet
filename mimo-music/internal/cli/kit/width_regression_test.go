package kit

import (
	"strings"
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

// TestRenderLine_FitsAllCombinations 暴力扫描:多档进度 × 多终端宽度 × 总bar/子bar。
// meta 宽度随数值变化(9%→100%、B→MB→GB),必须任何组合都不溢出。
// 这是堆叠 bug 的真正守护:之前估算 metaWidth 导致边界组合溢出。
func TestRenderLine_FitsAllCombinations(t *testing.T) {
	t.Parallel()
	progresses := []struct{ cur, total int64 }{
		{0, 3_400_000},
		{1, 3_400_000}, // 极小:计数 "1 B/3.2 MB"
		{500, 3_400_000},
		{1_700_000, 3_400_000},
		{3_399_999, 3_400_000}, // 99%
		{3_400_000, 3_400_000}, // 100% 完成
	}
	// cols≥80 是现实终端宽度,必须严格不溢出。cols=60 太窄(barWidth floor=4),
	// 允许略溢出——窄终端优先保证有进度条,折行可接受。
	termCols := []int{80, 100, 120, 200}

	for _, p := range progresses {
		for _, cols := range termCols {
			done := p.cur >= p.total
			state := StateActive
			if done {
				state = StateDone
			}
			// 子 bar
			subBar := &Bar{Label: "Beyond - 海阔天空", Total: p.total, Current: p.cur, State: state, ewma: 1_800_000, startedAt: time.Now()}
			line := renderLine(subBar, cols, 0, false)
			if w := runewidth.StringWidth(line); w > cols {
				t.Errorf("子bar cur=%d cols=%d: 整行宽 %d > %d\n  %q", p.cur, cols, w, cols, line)
			}
			// 总 bar
			totalBar := &Bar{Label: "我喜欢的音乐", Total: p.total * 9, Current: p.cur * 9, State: state, IsTotal: true, eta: 300_000_000_000, startedAt: time.Now()}
			line = renderLine(totalBar, cols, 0, false)
			if w := runewidth.StringWidth(line); w > cols {
				t.Errorf("总bar cur=%d cols=%d: 整行宽 %d > %d\n  %q", p.cur*9, cols, w, cols, line)
			}
		}
	}
}

// TestRenderLine_SweepBarWidthStable 推进全程(cur 0→total 密集扫描)meta 位置恒定。
// 回归:cur 跨 formatBytes 单位边界("9.5 KB"→"10.7 KB")字符串变宽,
// 曾把进度条挤短 1~2 列、右侧数字漂移。修复:计数列固定 9 列。
func TestRenderLine_SweepBarWidthStable(t *testing.T) {
	t.Parallel()
	total := int64(3_400_000)
	cols := 120
	totalStr := formatBytes(total)
	firstPos := -1
	for cur := int64(0); cur <= total; cur += 997 {
		b := &Bar{Label: "Beyond - 海阔天空", Total: total, Current: cur, State: StateActive, startedAt: time.Now()}
		line := renderLine(b, cols, 0, false)
		pos := strings.LastIndex(line, "/"+totalStr)
		if firstPos < 0 {
			firstPos = pos
		}
		if pos != firstPos {
			t.Fatalf("cur=%d (%s): counters 位置 %d ≠ 初始 %d(进度条长度跳变)\n  %q",
				cur, formatBytes(cur), pos, firstPos, line)
		}
	}
}

// TestRenderLine_LongMetaFits 速度/ETA 超宽值不溢出整行(折行堆叠守护)。
// 回归:metaW 曾按常量 10 算,"ETA 2:00:00"(11 列)溢出 1 列折行。
// 修复:ETA≥1h 降级 ">1h";metaW 按 extra 实际宽度兜底。
func TestRenderLine_LongMetaFits(t *testing.T) {
	t.Parallel()
	for _, cols := range []int{80, 100, 120} {
		// ETA ≥ 1h:降级为 "ETA >1h"
		totalBar := &Bar{Label: "我喜欢的音乐", Total: 35_800_000, Current: 100_000, State: StateActive, IsTotal: true, eta: 2 * time.Hour, startedAt: time.Now()}
		line := renderLine(totalBar, cols, 0, false)
		if w := runewidth.StringWidth(line); w > cols {
			t.Errorf("ETA≥1h cols=%d: 整行宽 %d > %d(折行堆叠)\n  %q", cols, w, cols, line)
		}
		// 速度上限:"1023.9 KB/s" = 11 列
		subBar := &Bar{Label: "Beyond - 海阔天空", Total: 3_400_000, Current: 1_700_000, State: StateActive, ewma: 1023.9 * 1024, startedAt: time.Now()}
		line = renderLine(subBar, cols, 0, false)
		if w := runewidth.StringWidth(line); w > cols {
			t.Errorf("高速 cols=%d: 整行宽 %d > %d(折行堆叠)\n  %q", cols, w, cols, line)
		}
	}
}

// TestRenderLine_MultiBarAligned 多 bar 之间右缘对齐(总 bar 与子 bar 的 bar 段等长)。
// 回归:total 不补齐时,总 bar("34.1 MB")与子 bar("3.2 MB")计数宽度不同,
// bar 段长度差 1~2 列,多行进度条右缘不对齐。修复:计数整组左补齐到固定 19 列。
// 断言:整行等宽 + "100%" 位置一致(右缘数字对齐 = bar 段等长)。
func TestRenderLine_MultiBarAligned(t *testing.T) {
	t.Parallel()
	for _, cols := range []int{80, 100, 120} {
		totalBar := &Bar{Label: "我喜欢的音乐", Total: 35_800_000, Current: 35_800_000, State: StateDone, IsTotal: true}
		subBar := &Bar{Label: "Beyond - 海阔天空", Total: 3_400_000, Current: 3_400_000, State: StateDone}
		lt := renderLine(totalBar, cols, 0, false)
		ls := renderLine(subBar, cols, 0, false)
		if wt, ws := runewidth.StringWidth(lt), runewidth.StringWidth(ls); wt != ws {
			t.Errorf("cols=%d: 整行宽度不齐(%d ≠ %d):\n  total=%q\n  sub  =%q", cols, wt, ws, lt, ls)
		}
		posT := runewidth.StringWidth(lt[:strings.LastIndex(lt, "100%")])
		posS := runewidth.StringWidth(ls[:strings.LastIndex(ls, "100%")])
		if posT != posS {
			t.Errorf("cols=%d: 百分比显示列不齐(%d ≠ %d),bar 段不等长:\n  total=%q\n  sub  =%q", cols, posT, posS, lt, ls)
		}
	}
}
