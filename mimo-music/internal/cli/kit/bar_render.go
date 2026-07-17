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
	"time"

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
		// 完成态用音符 ♪(绿色),不用对号 ✓。保留满进度条。
		prefix = colorWrap("♪", ansiGreen, color)
		body = renderProgressBar(b, width, color)
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
		body = renderProgressBar(b, width, color)
	}
	return "  " + prefix + " " + label + " " + body
}

// renderProgressBar 渲染进度条 + 计数 + 百分比 + (速度/ETA)。
//
// 字段宽度固定对齐(关键):计数/百分比/速度/ETA 都补齐到固定显示宽度,
// 这样进度推进(cur 跨 formatBytes 单位边界)、状态切换(进行→完成)时
// meta 总宽恒定 → barWidth 恒定 → 进度条不抖、数字位置不漂移。
// 完成态速度/ETA 位置补空格占位(宽度不变)。
//
// barWidth = 总宽 - 固定开销(27) - meta固定宽 - 分隔。
func renderProgressBar(b *Bar, totalWidth int, color bool) string {
	// 1. 计数:cur/total 各自右对齐到固定 9 列。
	//    formatBytes 的 %.1f 值恒 < 1024,上限 "1023.9 KB" = 9 列;
	//    若只补齐到 total 的宽度,cur 跨单位边界("9.5 KB"→"10.7 KB"→"1.0 MB")
	//    会超出假设宽度,把 bar 挤短 1~2 列、数字漂移(推进跳变 bug)。
	totalBytesStr := formatBytes(b.Total)
	curBytesStr := formatBytes(b.Current)
	const byteW = 9
	if cw := runewidth.StringWidth(curBytesStr); cw < byteW {
		curBytesStr = strings.Repeat(" ", byteW-cw) + curBytesStr
	}
	if tw := runewidth.StringWidth(totalBytesStr); tw < byteW {
		totalBytesStr = strings.Repeat(" ", byteW-tw) + totalBytesStr
	}
	counters := curBytesStr + "/" + totalBytesStr
	countersW := runewidth.StringWidth(counters)

	// 2. 百分比:右对齐到 4 列("100%"/"  9%")。
	pct := formatPercent(b.Current, b.Total)
	pctW := 4
	if pw := runewidth.StringWidth(pct); pw < pctW {
		pct = strings.Repeat(" ", pctW-pw) + pct
	}

	// 3. 速度/ETA:固定列宽,完成态或无值时补空格占位。
	//    速度上限 "1023.9 KB/s" = 11 列;ETA ≥1h 的 h:mm:ss 会超宽,
	//    降级为 ">1h"(此时精确 ETA 无意义,恒宽防溢出更重要)。
	const metaExtraW = 11
	var extra string
	if b.State == StateActive {
		if b.IsTotal {
			if b.eta >= time.Hour {
				extra = "ETA >1h"
			} else {
				extra = "ETA " + formatDuration(b.eta)
			}
		} else if b.ewma > 0 {
			extra = formatSpeed(b.ewma)
		}
	}
	if ew := runewidth.StringWidth(extra); ew < metaExtraW {
		extra = extra + strings.Repeat(" ", metaExtraW-ew)
	}

	// 4. meta 总宽 = 计数 + 1 + 百分比 + 1 + 速度/ETA。
	//    extra 取实际宽度兜底:即使异常值超宽,也只是 bar 变窄而非整行溢出折行。
	metaW := countersW + 1 + pctW + 1 + runewidth.StringWidth(extra)

	// 5. barWidth = 总宽 - 固定开销(27) - meta - 分隔。
	const fixedOverhead = 27
	barWidth := totalWidth - fixedOverhead - metaW - 1
	if barWidth < 4 {
		barWidth = 4
	}
	bar := RenderBar(b.Current, b.Total, barWidth, color)

	return bar + " " + counters + " " + pct + " " + extra
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
