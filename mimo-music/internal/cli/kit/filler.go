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
// 布局原则(单行 filler):
//   - 已完成段:全亮 ⣿,渐变色填充
//   - 边界字符:按亚进度点亮 0..8 个点,平滑锯齿
//   - 未完成段:稀疏锚点(每隔几列底部一个点),形成「轨道」指引而非空白
package kit

import (
	"fmt"
	"io"
	"math"
	"strings"

	"github.com/vbauerster/mpb/v8/decor"
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

// percent 从 Statistics 算进度百分比 [0,1]。Total ≤ 0 时返回 0。
func percent(stat decor.Statistics) float64 {
	if stat.Total <= 0 {
		return 0
	}
	return float64(stat.Current) / float64(stat.Total)
}

// brailleRune 按 8 位点阵构造盲文字符。
func brailleRune(dots byte) rune { return rune(0x2800 | int(dots)) }

// BrailleFiller 盲文点阵进度条。
//
// Color 控制 true color 输出(truecolor 终端设 true;管道/不支持时 false)。
// 渲染规则见包注释。填充色随进度位置从青绿渐变到暖橙,完成态变绿。
type BrailleFiller struct {
	Color bool
}

// Fill 实现 mpb.BarFiller。
//
// 严格保证可见宽度 == stat.AvailableWidth:每个位置恰好输出 1 个盲文 cell,
// ANSI 转义不计入显示宽度(mpb 用 stripansi 剥离后对齐)。
func (b BrailleFiller) Fill(w io.Writer, stat decor.Statistics) error {
	width := stat.AvailableWidth
	if width < 4 {
		width = 4
	}
	pct := percent(stat)

	// 字符级位置 + 亚像素余数(决定边界字符点亮几个点)。
	totalSub := float64(width) * pct
	filled := int(totalSub)
	subProgress := totalSub - float64(filled)
	if filled > width {
		filled = width
		subProgress = 0
	}
	// 进度推进到末位但未完成时,边界就是最后一格的亚进度。
	borderIdx := filled
	if borderIdx >= width {
		borderIdx = width - 1
	}

	// 配色:青绿 → 天青 → 暖橙(冷暖跨度大,渐变可辨且不刺眼)。
	cStart := [3]int{64, 220, 200} // 青绿
	cMid := [3]int{120, 200, 255}  // 天青
	cEnd := [3]int{255, 150, 80}   // 暖橙
	cDone := [3]int{80, 220, 130}  // 完成(绿)

	var buf strings.Builder
	// 优化:已完成段逐格颜色相邻,用单一 ANSI 设置可减少转义密度(降低闪烁概率)。
	// 但相邻颜色差异很小,逐格输出更平滑;权衡后仍逐格输出。
	for i := 0; i < width; i++ {
		var dots byte
		var color [3]int
		switch {
		case stat.Completed:
			dots, color = 0xFF, cDone
		case i < filled:
			// 已完成:全亮。
			dots = 0xFF
			color = gradientAt(float64(i)+0.5, width, cStart, cMid, cEnd)
		case i == borderIdx && (subProgress > 0 || filled == width-1):
			// 边界:亚像素逐点亮。
			if subProgress <= 0 {
				subProgress = 1 // 末位推进
			}
			dots = subChar(subProgress)
			color = gradientAt(float64(i)+0.5, width, cStart, cMid, cEnd)
		default:
			// 未完成:轨道锚点(每隔 2 格点亮左下角一个点)。
			dots, color = ghostDots(i)
		}
		buf.WriteString(rgb(color[0], color[1], color[2], b.Color))
		buf.WriteRune(brailleRune(dots))
		if b.Color {
			buf.WriteString(ansiReset)
		}
	}
	_, err := fmt.Fprint(w, buf.String())
	return err
}

// subChar 边界字符:按亚进度 subProgress∈(0,1] 点亮 0..8 个点。
// 点亮顺序模仿「水位上涨」——左列从底向上升满,再右列从底向上升满:
//
//	7→3→2→1(左列底→顶)  然后  8→6→5→4(右列底→顶)
//
// 视觉上像液体从底部填满一个 cell,符合「下载流进」的直觉。
func subChar(subProgress float64) byte {
	count := int(math.Ceil(subProgress*8 - 1e-9))
	if count < 0 {
		count = 0
	}
	if count > 8 {
		count = 8
	}
	// 水位上涨顺序:左列 7,3,2,1;右列 8,6,5,4。
	order := [8]byte{0x40, 0x04, 0x02, 0x01, 0x80, 0x20, 0x10, 0x08}
	var dots byte
	for j := 0; j < count; j++ {
		dots |= order[j]
	}
	return dots
}

// ghostDots 未完成段轨道锚点:每 3 格点亮左下角一个点(位 7),其余全灭。
// 形成等距的稀疏引导点,既不抢视觉焦点,又让进度条有「延伸轨道」感。
func ghostDots(i int) (byte, [3]int) {
	if i%3 == 1 {
		return 0x40, [3]int{70, 82, 102}
	}
	return 0, [3]int{40, 48, 60} // 全灭,颜色对空字符无影响但保持一致
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
