// Package kit 的进度条视觉实现 —— 盲文点阵 + true color 渐变。
//
// 设计核心:每个盲文字符是 2×4 的 8 点位像素(U+2800..U+28FF),一个终端 cell
// 承载 8 个亚像素。进度边界用「逐点点亮」平滑过渡,而非整块跳变;配合
// 24-bit true color 渐变,达到接近 LED 点阵屏的细腻度。
//
// 点位编码(Unicode U+2800 基址 + 8 位偏移):
//
//	┌──┬──┐
//	│1 │4 │     1=0x01 2=0x02 3=0x04 4=0x08
//	│2 │5 │     5=0x10 6=0x20 7=0x40 8=0x80
//	│3 │6 │     rune(0x2800 | dots)
//	│7 │8 │     ⣿ = 全 8 点亮(0xFF),⠀ = 全灭(0x00)
//	└──┴──┘
//
// 布局原则(单行):
//   - 已完成段:全亮 ⣿,渐变色填充
//   - 边界字符:按亚进度点亮 0..8 个点,平滑锯齿
//   - 未完成段:稀疏锚点(每隔几列底部一个点),形成「轨道」指引而非空白
package kit

import (
	"fmt"
	"math"
	"strings"
)

// ANSI 重置序列。true color 用 38;2;R;G;B 形态。
const ansiReset = "\x1b[0m"

// rgb 返回 24-bit 前景色序列。enabled=false 时返回空串(纯文本降级)。
func rgb(r, g, b int, enabled bool) string {
	if !enabled {
		return ""
	}
	return fmt.Sprintf("\x1b[38;2;%d;%d;%dm", r, g, b)
}

// lerpColor 在两个 RGB 之间按 t∈[0,1] 线性插值。
func lerpColor(c1, c2 [3]int, t float64) [3]int {
	if t < 0 {
		t = 0
	}
	if t > 1 {
		t = 1
	}
	return [3]int{
		int(math.Round(float64(c1[0]) + float64(c2[0]-c1[0])*t)),
		int(math.Round(float64(c1[1]) + float64(c2[1]-c1[1])*t)),
		int(math.Round(float64(c1[2]) + float64(c2[2]-c1[2])*t)),
	}
}

// brailleRune 按 8 位点阵构造盲文字符。
func brailleRune(dots byte) rune { return rune(0x2800 | int(dots)) }

// visibleCellCount 统计字符串的可见 cell 数:剥离 ANSI 转义后的 rune 数。
// 用于验证渲染宽度稳定(宽度不稳是终端光标跳的根因),以及 label 填充计算。
func visibleCellCount(s string) int {
	visible := 0
	inEsc := false
	for _, r := range s {
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
	return visible
}

// RenderBar 渲染单条盲文进度条为字符串(纯函数,无副作用,无 I/O 依赖)。
//
// current/total 决定进度;width 是盲文条占的字符数;color 控制是否输出 true color。
// total ≤ 0 时按 0% 处理。视觉:已完成段全亮+渐变(青绿→天青→暖橙),
// 边界水位上涨(8 级亚像素),未完成段轨道锚点。
func RenderBar(current, total int64, width int, color bool) string {
	if width < 4 {
		width = 4
	}
	pct := 0.0
	if total > 0 {
		pct = float64(current) / float64(total)
	}

	// 字符级位置 + 亚像素余数(决定边界字符点亮几个点)。
	totalSub := float64(width) * pct
	filled := int(totalSub)
	subProgress := totalSub - float64(filled)
	if filled > width {
		filled = width
		subProgress = 0
	}
	borderIdx := filled
	if borderIdx >= width {
		borderIdx = width - 1
	}

	// 配色:青绿 → 天青 → 暖橙(冷暖跨度大,渐变可辨且不刺眼)。
	cStart := [3]int{64, 220, 200}
	cMid := [3]int{120, 200, 255}
	cEnd := [3]int{255, 150, 80}

	var buf strings.Builder
	for i := 0; i < width; i++ {
		var dots byte
		var c [3]int
		switch {
		case i < filled:
			dots = 0xFF
			c = gradientAt(float64(i)+0.5, width, cStart, cMid, cEnd)
		case i == borderIdx && (subProgress > 0 || filled == width-1):
			sp := subProgress
			if sp <= 0 {
				sp = 1
			}
			dots = subChar(sp)
			c = gradientAt(float64(i)+0.5, width, cStart, cMid, cEnd)
		default:
			dots, c = ghostDots(i)
		}
		buf.WriteString(rgb(c[0], c[1], c[2], color))
		buf.WriteRune(brailleRune(dots))
		if color {
			buf.WriteString(ansiReset)
		}
	}
	return buf.String()
}

// subChar 边界字符:按亚进度 subProgress∈(0,1] 点亮 0..8 个点。
// 点亮顺序模仿「水位上涨」——左列从底向上升满,再右列从底向上升满:
//
//	7→3→2→1(左列底→顶)  然后  8→6→5→4(右列底→顶)
func subChar(subProgress float64) byte {
	count := int(math.Ceil(subProgress*8 - 1e-9))
	if count < 0 {
		count = 0
	}
	if count > 8 {
		count = 8
	}
	order := [8]byte{0x40, 0x04, 0x02, 0x01, 0x80, 0x20, 0x10, 0x08}
	var dots byte
	for j := 0; j < count; j++ {
		dots |= order[j]
	}
	return dots
}

// ghostDots 未完成段轨道锚点:每 3 格点亮左下角一个点,其余全灭。
func ghostDots(i int) (byte, [3]int) {
	if i%3 == 1 {
		return 0x40, [3]int{70, 82, 102}
	}
	return 0, [3]int{40, 48, 60}
}

// gradientAt 三段渐变(start→mid→end)在位置 pos/width 处的插值色。
func gradientAt(pos float64, width int, start, mid, end [3]int) [3]int {
	if width <= 0 {
		return start
	}
	t := pos / float64(width)
	if t < 0.5 {
		return lerpColor(start, mid, t*2)
	}
	return lerpColor(mid, end, (t-0.5)*2)
}
