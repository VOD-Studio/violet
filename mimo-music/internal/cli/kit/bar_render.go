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

	"github.com/mattn/go-runewidth"
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
	// label 显示宽度:固定列数(中文按2列算),右侧补齐。
	// 超长的 label 截断,避免占用过多宽度导致进度条被挤没。
	const labelWidth = 22
	label := truncateLabel(b.Label, labelWidth-1) // 留1列给可能的截断省略号
	label = padLabel(label, labelWidth)

	var prefix, body string
	switch b.State {
	case StateDone:
		prefix = colorWrap("✓", ansiGreen, color)
		// 完成态保留满进度条(不切换成纯文字),只是 prefix 变 ✓、不再显示速度/ETA。
		body = renderProgressBar(b, width, color, false)
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
		body = renderProgressBar(b, width, color, true)
	}
	return "  " + prefix + " " + label + " " + body
}

// renderProgressBar 渲染进度条 + 计数 + 百分比 + 可选(ETA/速度)。
//
// showMeta=true(进行中)时,总 bar 追加 ETA、子 bar 追加 EWMA 速度。
// showMeta=false(完成态)只显示进度条 + 计数 + 百分比,不带速度/ETA(已完成无需)。
//
// barWidth 按「总宽 - 固定开销」动态计算,保证整行 ≤ 终端宽度,避免自动折行
// 破坏光标上移重绘(折行是 multi 堆叠的根因)。
func renderProgressBar(b *Bar, totalWidth int, color, showMeta bool) string {
	// 固定开销:前缀2 + label22 + 分隔符3 + 进度条后字段。
	// 字段宽度:计数 "12.3 MB/34.1 MB" ~16 + 百分比 "100%" ~4 + 速度 "1.8 MB/s" ~10 + 间距。
	metaWidth := 0
	if showMeta {
		if b.IsTotal {
			metaWidth = 24 // "ETA 0:05" + 计数 + 百分比
		} else {
			metaWidth = 30 // 速度 + 计数 + 百分比
		}
	} else {
		metaWidth = 22 // 完成态:计数 + 百分比
	}
	const fixedOverhead = 27 // 前缀 + label + 分隔
	barWidth := totalWidth - fixedOverhead - metaWidth
	if barWidth < 8 {
		barWidth = 8
	}
	bar := RenderBar(b.Current, b.Total, barWidth, color)

	var parts []string
	parts = append(parts, bar)
	parts = append(parts, formatBytes(b.Current)+"/"+formatBytes(b.Total))
	parts = append(parts, formatPercent(b.Current, b.Total))
	if showMeta {
		if b.IsTotal {
			parts = append(parts, "ETA "+formatDuration(b.eta))
		} else if b.ewma > 0 {
			parts = append(parts, formatSpeed(b.ewma))
		}
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

// padLabel 把 label 填充到固定显示宽度(右侧补空格),按 CJK 全宽计算。
// 中文占2列、ASCII占1列,用 runewidth 精确计算,避免终端自动折行。
func padLabel(s string, width int) string {
	w := runewidth.StringWidth(s)
	if w >= width {
		return s
	}
	return s + strings.Repeat(" ", width-w)
}

// truncateLabel 把 label 按显示宽度截断,超长尾部加 …(占1列)。
// 防止超长歌名撑爆整行宽度导致终端自动折行。
func truncateLabel(s string, maxDisplayWidth int) string {
	if runewidth.StringWidth(s) <= maxDisplayWidth {
		return s
	}
	return runewidth.Truncate(s, maxDisplayWidth, "…")
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
