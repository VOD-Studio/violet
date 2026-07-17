// Package player 抽象音频播放能力,供 song play 命令与未来 TUI 复用。
package player

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// TimedLine 是一行带时间戳的歌词。
type TimedLine struct {
	TimeMs int64  // 从开头算的毫秒数
	Text   string // 歌词行文本
}

// timestampRegexp 匹配单个 [mm:ss.xx] 时间戳;xx 为 1-3 位(实践中 2/3 位居多,
// 允许 1 位以容忍非严格 LRC)。
var timestampRegexp = regexp.MustCompile(`\[(\d+):(\d+)(?:[.:](\d{1,3}))?\]`)

// parseTimestamp 把 [mm:ss.xx] 的捕获组转为毫秒。
// mm:ss 是必填,毫秒段缺省视为 0;2 位按百分秒、3 位按毫秒。
// 1 位按十分秒(实践中罕见,容忍处理)。
func parseTimestamp(min, sec, frac string) int64 {
	ms := int64(atoi(min)) * 60 * 1000
	ms += int64(atoi(sec)) * 1000
	if frac == "" {
		return ms
	}
	switch len(frac) {
	case 1:
		ms += int64(atoi(frac)) * 100 // 十分秒
	case 2:
		ms += int64(atoi(frac)) * 10 // 百分秒
	default:
		ms += int64(atoi(frac)) // 毫秒(3 位)
	}
	return ms
}

// atoi 是 strconv.Atoi 的简写;正则保证只匹配数字,忽略错误。
func atoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

// ParseLRC 忠实解析 LRC 文本,保持源序(不排序)。
// 空输入或无有效时间戳的输入返回空切片(不报错)。
func ParseLRC(text string) []TimedLine {
	if text == "" {
		return nil
	}
	var lines []TimedLine
	for _, raw := range strings.Split(text, "\n") {
		matches := timestampRegexp.FindAllStringSubmatch(raw, -1)
		if len(matches) == 0 {
			continue // 无时间戳行:跳过(元数据 tag、空白行、纯文本)
		}
		// 文本是去掉所有时间戳后的剩余部分。
		rest := timestampRegexp.ReplaceAllString(raw, "")
		for _, m := range matches {
			lines = append(lines, TimedLine{
				TimeMs: parseTimestamp(m[1], m[2], m[3]),
				Text:   rest,
			})
		}
	}
	return lines
}

// SortedLRC 在 ParseLRC 基础上按 TimeMs 升序稳定排序。
// 相等时间戳保持源相对顺序(稳定)。
// 用于:song play --lyric 的当前行二分查找。
func SortedLRC(text string) []TimedLine {
	lines := ParseLRC(text)
	// slices.SortStableFunc 是稳定排序——相等 TimeMs 保持源序。
	// 不就地改 ParseLRC 的返回,而是拷贝后排序(ParseLRC 契约是源序)。
	sorted := make([]TimedLine, len(lines))
	copy(sorted, lines)
	slices.SortStableFunc(sorted, func(a, b TimedLine) int {
		switch {
		case a.TimeMs < b.TimeMs:
			return -1
		case a.TimeMs > b.TimeMs:
			return 1
		default:
			return 0
		}
	})
	return sorted
}
