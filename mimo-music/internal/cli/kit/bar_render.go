// Package kit 的进度条行渲染 + diff 输出。
//
// 渲染模型(学 indicatif 的 diff 渲染,消除 mpb 的 \e[J 整块清屏闪烁):
//   - 每帧把所有 bar 渲染成行字符串数组
//   - 与上一帧逐行重写:光标上移 + \r(回车行首) + \e[K(清当前行,非整屏) + 写新行
//   - 整个 diff 结果单次 Write,终端原子渲染,无中间空白态
//
// 关键:\e[K 只清当前行(不像 mpb 的 \e[J 清整屏),无空白帧 → 无闪烁。
package kit

import (
	"strconv"
	"strings"
)

// 标准盲文 spinner 帧序列(转一圈)。
var spinnerFrames = []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

// ANSI 颜色(完成/失败的语义色)。
const (
	ansiGreen  = "\x1b[32m"
	ansiRed    = "\x1b[31m"
	ansiYellow = "\x1b[33m"
)

// renderLine 渲染单个 bar 为一行字符串。
//
// 按状态分派:
//   - 完成:  ✓ label    size       (绿色,静态,不再动画)
//   - 失败:  ✗ label    err        (红色)
//   - 进行:  ⠼ label    进度条 计数 pct 速度(总 bar 显 ETA)
//   - 等待:  · label    等待中
//
// spinnerIdx 由 Progress 的 steady tick 推进,让进行中的 spinner 转动。
func renderLine(b *Bar, width, spinnerIdx int, color bool) string {
	const labelWidth = 22
	label := padRunes(b.Label, labelWidth)

	var prefix, body string
	switch b.State {
	case StateDone:
		prefix = colorWrap("✓", ansiGreen, color)
		body = formatBytes(b.Total)
	case StateFailed:
		prefix = colorWrap("✗", ansiRed, color)
		if b.errMsg != "" {
			body = b.errMsg
		} else {
			body = "失败"
		}
	case StateWaiting:
		prefix = "·"
		if b.errMsg != "" {
			body = b.errMsg
		} else {
			body = "等待中"
		}
	case StateActive:
		if b.IsTotal {
			prefix = "♪"
		} else {
			prefix = spinnerFrames[spinnerIdx%len(spinnerFrames)]
		}
		body = renderActiveBody(b, width, color)
	}
	return "  " + prefix + " " + label + " " + body
}

// renderActiveBody 渲染进行中状态的内容:进度条 + 计数 + 百分比 + (总bar)ETA/速度。
func renderActiveBody(b *Bar, totalWidth int, color bool) string {
	// 进度条宽度:总宽度减去前缀+label+计数+百分比等约 40 字符。
	barWidth := totalWidth - 44
	if barWidth < 8 {
		barWidth = 8
	}
	bar := RenderBar(b.Current, b.Total, barWidth, color)

	var parts []string
	parts = append(parts, bar)
	parts = append(parts, formatBytes(b.Current)+"/"+formatBytes(b.Total))
	parts = append(parts, formatPercent(b.Current, b.Total))

	// 总 bar 显示 ETA,子 bar 显示速度。
	if b.IsTotal {
		parts = append(parts, "ETA "+formatDuration(b.eta))
	} else if b.ewma > 0 {
		parts = append(parts, formatSpeed(b.ewma))
	}
	return strings.Join(parts, " ")
}

// colorWrap 用 ANSI 颜色包裹字符串(color=false 时原样返回)。
func colorWrap(s, ansi string, color bool) string {
	if !color {
		return s
	}
	return ansi + s + ansiReset
}

// padRunes 把字符串按 rune 数填充到 width(右侧补空格),超长不截断。
// 注:近似计算,不区分 CJK 全宽(进度条场景够用,label 一般是中文歌名)。
func padRunes(s string, width int) string {
	vis := visibleCellCount(s)
	if vis >= width {
		return s
	}
	return s + strings.Repeat(" ", width-vis)
}

// diffWrite 输出新帧,与 prev diff。
//
// 字节序列:
//  1. 光标上移 len(prev) 行(\e[<N>A)——回到帧首
//  2. 逐行:\r(回车行首) + \e[K(清当前行到行尾) + 内容 + \n
//  3. 若 next 比 prev 短,\e[J 清多余残留行(唯一安全用 \e[J 的场景)
//
// 简化:逐行全重写(未做"未变行跳过"优化)。代价是多写几字节,但:
//   - \e[K 只清当前行(非 \e[J 整屏),无空白帧
//   - 单次 Write 原子输出
//   - 无光标状态机,逻辑简单可测
func diffWrite(out writeFlusher, prev, next []string) {
	var buf strings.Builder
	if n := len(prev); n > 0 {
		buf.WriteString("\x1b[")
		buf.WriteString(strconv.Itoa(n))
		buf.WriteString("A")
	}
	for _, line := range next {
		buf.WriteString("\r\x1b[K")
		buf.WriteString(line)
		buf.WriteString("\n")
	}
	if len(next) < len(prev) {
		buf.WriteString("\x1b[J")
	}
	out.WriteString(buf.String())
}
