package post

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/mozillazg/go-pinyin"
)

// slugFallbackPrefix 空 slug 兜底前缀
const slugFallbackPrefix = "post"

// slugMaxLen slug 最大长度（按 `-` 边界截断，避免 URL 过长）
const slugMaxLen = 60

// nonAlnum 非小写字母数字（用于折叠为单连字符）
var nonAlnum = regexp.MustCompile(`[^a-z0-9]+`)

// multiDash 连续连字符压缩为单个
var multiDash = regexp.MustCompile(`-{2,}`)

// GenerateSlug 从标题生成 ASCII slug。
//
// 中文走无声调全拼（"我的文章" → "wo-de-wen-zhang"），ASCII 字母数字
// 段原样保留并小写（"React 入门" → "react-ru-men"，React 保持一词
// 不被拆成 r-e-a-c-t），非字母数字字符折叠为单连字符。与 tag 模块的
// GenerateSlug 刻意不同——tag 保留中文（unicode.Han），post 必须
// ASCII 以匹配 IsValidSlug 的 [a-z0-9-] 契约。
//
// 纯函数，不查 DB；冲突解析由 service 层在 Create/Update 时处理。
func GenerateSlug(title string) string {
	// 按连续中文 / 连续非中文分段:中文段逐字转拼音(每字输出用空格分隔),
	// 非中文段原样保留(保留 "React" 这样的整词),拼接后统一规范化。
	// 直接用 go-pinyin 的 LazyConvert 会把每个 ASCII 字符拆成单元素,
	// 导致 "React" 变成 "r-e-a-c-t",所以必须自己分组。
	segments := splitHanSegments(strings.TrimSpace(title))
	parts := make([]string, 0, len(segments))
	pinyinArgs := pinyin.NewArgs()
	pinyinArgs.Style = pinyin.Normal
	for _, seg := range segments {
		if seg.isHan {
			// 中文段:逐字转无声调拼音,字间用空格分隔(规范化时折叠为 -)
			for _, r := range seg.text {
				pys := pinyin.SinglePinyin(r, pinyinArgs)
				if len(pys) > 0 {
					parts = append(parts, pys[0])
				}
			}
		} else {
			parts = append(parts, seg.text)
		}
	}

	slug := strings.ToLower(strings.Join(parts, " "))
	slug = nonAlnum.ReplaceAllString(slug, "-")
	slug = multiDash.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")

	slug = truncateSlug(slug)

	if slug == "" {
		return slugFallbackPrefix + "-" + uuid.New().String()[:8]
	}
	return slug
}

type hanSegment struct {
	text  string
	isHan bool
}

// splitHanSegments 把字符串切成「连续中文」与「连续非中文」交替的段。
// 空字符串返回空切片。
func splitHanSegments(s string) []hanSegment {
	if s == "" {
		return nil
	}
	var segments []hanSegment
	var buf strings.Builder
	bufIsHan := false
	flush := func() {
		if buf.Len() == 0 {
			return
		}
		segments = append(segments, hanSegment{text: buf.String(), isHan: bufIsHan})
		buf.Reset()
	}
	for _, r := range s {
		isHan := unicode.Is(unicode.Han, r)
		if buf.Len() > 0 && isHan != bufIsHan {
			flush()
		}
		bufIsHan = isHan
		buf.WriteRune(r)
	}
	flush()
	return segments
}

// truncateSlug 按 `-` 边界截断到 slugMaxLen，避免截断在词中间。
// 截断点取 slugMaxLen 范围内最后一个 `-`；没有 `-` 则硬截断。
func truncateSlug(slug string) string {
	if len(slug) <= slugMaxLen {
		return slug
	}
	cut := slug[:slugMaxLen]
	if idx := strings.LastIndex(cut, "-"); idx > 0 {
		return cut[:idx]
	}
	return cut
}
