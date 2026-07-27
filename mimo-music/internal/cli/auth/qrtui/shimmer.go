package qrtui

import (
	"math"
	"strings"
)

// shimmer 是对 oh-my-pi classic shimmer 的移植(packages/coding-agent/src/modes/theme/shimmer.ts)。
//
// 核心:一个窄亮带(band)以固定速度(30 cells/s)从左向右扫过文字。
// 带内字符按距亮带中心的余弦强度着色,带外是 dim 色(文字始终可读)。
// 强度分 3 档离散(low/mid/high),不是连续渐变——high 档加粗。
//
// 与「逐字符正弦相位」(彩虹)的本质区别:shimmer 任何时候只有亮带附近
// 几个字符变亮,其余维持 dim 可读;彩虹让所有字符同时变色。
//
// 关键参数照搬源码:
//   - SHIMMER_SPEED_CELLS_PER_S = 30(固定速度,长文不抖,每帧推进 ≤1 cell)
//   - CLASSIC_PADDING = 10(文字两侧虚拟填充,亮带从文字外开始扫入)
//   - CLASSIC_BAND_HALF_WIDTH = 6(亮带半宽,总宽 12 cell)
//   - TIER_HIGH = 0.65 / TIER_MID = 0.22(强度分档阈值)
//
// 调色板用紫粉主题(用户指定):low=暗紫(文字主体可读),mid=中紫,high=亮粉+bold。

const (
	shimmerSpeedCellsPerS = 30
	classicPadding         = 10
	classicBandHalfWidth   = 6
	intensityHigh          = 0.65
	intensityMid           = 0.22
)

// tier 三档颜色之一。
type tier int

const (
	tierLow tier = iota
	tierMid
	tierHighT
)

// shimmerPalette shimmer 的三档调色板。high 档是否加粗由 BoldHigh 控制。
// 颜色用 #RRGGBB hex 字符串(便于 hexToRGB 直接解析为 truecolor 转义)。
// 默认用紫粉主题(对齐后续 TUI 客户端的封面取色基调)。
type shimmerPalette struct {
	Low      string
	Mid      string
	High     string
	BoldHigh bool
}

// purplePalette 紫粉调色板:low=暗紫(对应 oh-my-pi dimGray 的可读主体),
// mid=中紫,high=亮粉+加粗。
var purplePalette = shimmerPalette{
	Low:      "#5a3a8a",
	Mid:      "#9d6ff5",
	High:     "#ee6ff8",
	BoldHigh: true,
}

// classicIntensity 单字符在时刻 timeMs 的强度 [0,1](照搬 oh-my-pi classicIntensity)。
//
// 亮带中心位置 pos = (time/1000 * 30) % period,period = length + 2*padding。
// 字符到亮带中心的距离 dist = |index + padding - pos|;dist >= bandHalfWidth 返回 0;
// 否则 0.5*(1 + cos(π*dist/bandHalfWidth))(余弦凸起,中心 1.0,边缘 0)。
// pos 保持浮点(不取整),保证余弦曲线平滑。
func classicIntensity(timeMs int64, index, length int) float64 {
	period := float64(length + classicPadding*2)
	pos := math.Mod(float64(timeMs)/1000*shimmerSpeedCellsPerS, period)
	if pos < 0 {
		pos += period
	}
	dist := math.Abs(float64(index+classicPadding) - pos)
	if dist >= classicBandHalfWidth {
		return 0
	}
	return 0.5 * (1 + math.Cos(math.Pi*dist/classicBandHalfWidth))
}

// tierFor 强度 → 离散档位(照搬源码 tierFor)。
func tierFor(intensity float64) tier {
	if intensity >= intensityHigh {
		return tierHighT
	}
	if intensity >= intensityMid {
		return tierMid
	}
	return tierLow
}

// activeBand 亮带在时刻 timeMs 覆盖的字符索引范围 [lo, hi](照搬源码 activeBand)。
// 带外字符强度保证为 0,可跳过逐字符计算。
func activeBand(timeMs, length int) (lo, hi int) {
	period := float64(length + classicPadding*2)
	pos := math.Mod(float64(timeMs)/1000*shimmerSpeedCellsPerS, period)
	if pos < 0 {
		pos += period
	}
	lo = int(pos) - classicPadding - classicBandHalfWidth
	hi = int(pos) - classicPadding + classicBandHalfWidth
	return
}

// tierSeq 一档颜色编译后的 ANSI 开/闭串(预编译,避免逐字符重复解析)。
type tierSeq struct {
	open  string
	close string
}

// compiledPalette 三档预编译 ANSI 串。按 run(同档连续字符)合并输出,
// 不是逐字符裹颜色码——照搬源码 compile + 同档合并的优化。
type compiledPalette struct {
	low, mid, high tierSeq
}

// compile 把 palette 解析为 ANSI 开/闭串。high 档加粗时 open 含 bold + 颜色,
// close 含 bold 复位 + 颜色复位。
func compile(p shimmerPalette) compiledPalette {
	fgReset := "\x1b[39m"
	boldOpen := "\x1b[1m"
	boldClose := "\x1b[22m"
	highOpen := "\x1b[38;2;" + hexToRGB(p.High) + "m"
	highClose := fgReset
	if p.BoldHigh {
		highOpen = boldOpen + highOpen
		highClose = boldClose + fgReset
	}
	return compiledPalette{
		low:  tierSeq{open: "\x1b[38;2;" + hexToRGB(p.Low) + "m", close: fgReset},
		mid:  tierSeq{open: "\x1b[38;2;" + hexToRGB(p.Mid) + "m", close: fgReset},
		high: tierSeq{open: highOpen, close: highClose},
	}
}

// shimmerText 把 s 按当前时刻 timeMs 做 shimmer 着色。
//
// 算法:遍历 s 的 rune,按 (字符位置, timeMs) 算强度 → 档位;
// 同档连续字符合并成一个 ANSI 包裹(减少转义序列数量)。
// 带外字符用 tierLow(主体可读)。
func shimmerText(s string, timeMs int64, p compiledPalette) string {
	if s == "" {
		return ""
	}
	runes := []rune(s)
	length := len(runes)
	bandLo, bandHi := activeBand(int(timeMs), length)

	var b strings.Builder
	runTier := tier(-1) // 哨兵,强制首字符开新 run
	runStart := 0
	flush := func(end int) {
		if runTier < 0 || end <= runStart {
			return
		}
		var seq tierSeq
		switch tier(runTier) {
		case tierLow:
			seq = p.low
		case tierMid:
			seq = p.mid
		case tierHighT:
			seq = p.high
		}
		b.WriteString(seq.open)
		b.WriteString(string(runes[runStart:end]))
		b.WriteString(seq.close)
	}
	for i := range runes {
		var t tier
		if i < bandLo || i > bandHi {
			t = tierLow
		} else {
			t = tierFor(classicIntensity(timeMs, i, length))
		}
		if t != runTier {
			flush(i)
			runTier = t
			runStart = i
		}
	}
	flush(length)
	return b.String()
}

// hexToRGB 把 #RRGGBB hex 字符串解析为 "R;G;B"(用于 truecolor 转义)。
func hexToRGB(hex string) string {
	if len(hex) != 7 || hex[0] != '#' {
		return "255;255;255" // 兜底白
	}
	r := hexByte(hex[1:3])
	g := hexByte(hex[3:5])
	b := hexByte(hex[5:7])
	return itoa(r) + ";" + itoa(g) + ";" + itoa(b)
}

// hexByte 两位 hex → 0-255。
func hexByte(s string) int {
	hi := hexNibble(s[0])
	lo := hexNibble(s[1])
	return hi<<4 | lo
}

func hexNibble(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return 0
}

// itoa 轻量整数转字符串(避免 strconv 引入)。
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [4]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func absFloat(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
