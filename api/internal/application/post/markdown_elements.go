package post

import (
	"strings"

	infracoderunner "blog-api/internal/infrastructure/coderunner"
)

// Markdown 元素提取器：扫描存储态 content_md，提取数学公式与围栏代码块。
//
// 与 math_extract.go 的关系：math_extract 是导入方向（HTML→Markdown 公式还原，
// scrape 流程），本文件是检索方向（存储态 Markdown→结构化元素），纯文本状态机，不复用。
//
// 优先级（对齐 CommonMark 语义）：
//   - 围栏代码块（```/~~~）最强：块内 $ 不识别为公式、块内反引号原样保留。
//   - 行内 code span（`...`）次之：span 内 $ 不识别为公式。
//   - 剩余区域扫公式：$$...$$（block，可跨行）优先于 $...$（inline，限同行）。
//
// 偏移均为字节偏移 [Start, End)，供上层截 context_snippet。

// MarkdownFormula 从 content_md 提取的数学公式。
type MarkdownFormula struct {
	Latex string // 定界符内的 LaTeX 源码（去首尾空白）
	Block bool   // true = $$...$$，false = $...$
	Start int    // 起始定界符字节偏移
	End   int    // 结束定界符之后字节偏移
}

// DisplayMode 返回 PRD 约定的展示模式字符串（inline/block）。
func (f MarkdownFormula) DisplayMode() string {
	if f.Block {
		return "block"
	}
	return "inline"
}

// MarkdownCodeBlock 从 content_md 提取的围栏代码块。
type MarkdownCodeBlock struct {
	Lang     string // 归一化语言 key（js→node 等，经 ParseFenceInfo）
	Runnable bool   // info string 含 runnable/run 标记
	Code     string // 围栏内代码原文
	Start    int    // 开围栏行首字节偏移
	End      int    // 闭围栏行尾之后字节偏移（未闭合则到 EOF）
}

// ExtractMarkdownElements 单遍提取 content_md 中的公式与代码块。
// 无命中时返回 nil, nil。
func ExtractMarkdownElements(contentMD string) ([]MarkdownFormula, []MarkdownCodeBlock) {
	blocks, fenced := scanFencedBlocks(contentMD)
	masked := make([]bool, len(contentMD))
	for _, sp := range fenced {
		markRange(masked, sp)
	}
	// 行内 code span 只在非围栏区域扫描，其区间加入掩码。
	for _, sp := range scanInlineCodeSpans(contentMD, masked) {
		markRange(masked, sp)
	}
	formulas := scanFormulas(contentMD, masked)
	return formulas, blocks
}

type byteSpan struct{ start, end int }

func markRange(masked []bool, sp byteSpan) {
	for i := sp.start; i < sp.end && i < len(masked); i++ {
		masked[i] = true
	}
}

// scanFencedBlocks 行级扫描围栏代码块，返回块列表与覆盖区间（含围栏行本身）。
// 未闭合围栏按 CommonMark 语义延伸到 EOF。
func scanFencedBlocks(content string) ([]MarkdownCodeBlock, []byteSpan) {
	var blocks []MarkdownCodeBlock
	var spans []byteSpan

	pos := 0
	for pos < len(content) {
		lineEnd := strings.IndexByte(content[pos:], '\n')
		var line string
		var next int
		if lineEnd < 0 {
			line = content[pos:]
			next = len(content)
		} else {
			line = content[pos : pos+lineEnd]
			next = pos + lineEnd + 1
		}

		fenceChar, fenceLen, info, ok := parseFenceOpen(line)
		if !ok {
			pos = next
			continue
		}

		// 找闭围栏：同字符、长度 ≥ 开围栏、info 只允许空白
		codeStart := next
		closePos, closeNext := -1, len(content)
		scan := next
		for scan < len(content) {
			le := strings.IndexByte(content[scan:], '\n')
			var l string
			var n int
			if le < 0 {
				l = content[scan:]
				n = len(content)
			} else {
				l = content[scan : scan+le]
				n = scan + le + 1
			}
			if isFenceClose(l, fenceChar, fenceLen) {
				closePos, closeNext = scan, n
				break
			}
			scan = n
		}

		var code string
		var end int
		if closePos < 0 {
			// 未闭合：代码到 EOF
			code = content[codeStart:]
			end = len(content)
		} else {
			code = content[codeStart:closePos]
			end = closeNext
		}
		code = strings.TrimSuffix(code, "\n")

		lang, runnable, _ := infracoderunner.ParseFenceInfo(info)
		blocks = append(blocks, MarkdownCodeBlock{
			Lang:     lang,
			Runnable: runnable,
			Code:     code,
			Start:    pos,
			End:      end,
		})
		spans = append(spans, byteSpan{pos, end})
		pos = end
	}
	return blocks, spans
}

// parseFenceOpen 解析开围栏行：≤3 前导空格 + ≥3 个相同 ``` 或 ~~~ + info string。
// 反引号围栏的 info 不允许再含反引号（CommonMark 限制，防误判）。
func parseFenceOpen(line string) (char byte, length int, info string, ok bool) {
	i := 0
	for i < len(line) && line[i] == ' ' && i < 4 {
		i++
	}
	if i > 3 {
		return 0, 0, "", false
	}
	rest := line[i:]
	if len(rest) < 3 {
		return 0, 0, "", false
	}
	c := rest[0]
	if c != '`' && c != '~' {
		return 0, 0, "", false
	}
	n := 0
	for n < len(rest) && rest[n] == c {
		n++
	}
	if n < 3 {
		return 0, 0, "", false
	}
	info = strings.TrimSpace(rest[n:])
	if c == '`' && strings.Contains(info, "`") {
		return 0, 0, "", false
	}
	return c, n, info, true
}

// isFenceClose 判断闭围栏行：≤3 前导空格 + 同字符且长度 ≥ openLen + 仅空白后缀。
func isFenceClose(line string, char byte, openLen int) bool {
	i := 0
	for i < len(line) && line[i] == ' ' && i < 4 {
		i++
	}
	if i > 3 {
		return false
	}
	rest := line[i:]
	n := 0
	for n < len(rest) && rest[n] == char {
		n++
	}
	if n < openLen {
		return false
	}
	return strings.TrimSpace(rest[n:]) == ""
}

// scanInlineCodeSpans 在非掩码区域扫描行内 code span（`code`），返回其区间。
// code span 可跨行（CommonMark），但本提取器按行内处理足够——多行 code span 罕见，
// 跨行时反引号各自不成对，自然不产生掩码，退化为普通文本，不误伤公式。
func scanInlineCodeSpans(content string, masked []bool) []byteSpan {
	var spans []byteSpan
	i := 0
	for i < len(content) {
		if masked[i] || content[i] != '`' {
			i++
			continue
		}
		// 数开反引号个数
		n := 0
		for i+n < len(content) && content[i+n] == '`' {
			n++
		}
		// 找同行等长闭反引号
		j := i + n
		for j < len(content) && content[j] != '\n' {
			if content[j] == '`' {
				m := 0
				for j+m < len(content) && content[j+m] == '`' {
					m++
				}
				if m == n {
					spans = append(spans, byteSpan{i, j + m})
					i = j + m
					goto next
				}
				j += m
				continue
			}
			j++
		}
		// 未配对：跳过开反引号
		i += n
	next:
	}
	return spans
}

// scanFormulas 在非掩码区域扫描 $...$ / $$...$$ 公式。
// 规则：\$ 转义跳过；$$ 配对其后最近 $$（可跨行）；$ 配对同行内 $，
// 且开 $ 后首字符非空白、闭 $ 前末字符非空白（Pandoc 启发式，减少价格 $5 误判）。
func scanFormulas(content string, masked []bool) []MarkdownFormula {
	var formulas []MarkdownFormula
	i := 0
	for i < len(content) {
		if masked[i] || content[i] != '$' {
			i++
			continue
		}
		// 转义 \$
		if i > 0 && content[i-1] == '\\' {
			i++
			continue
		}
		block := i+1 < len(content) && content[i+1] == '$' && !masked[i+1]
		if block {
			open := i + 2
			close := findUnescapedDollarPair(content, masked, open, true)
			if close < 0 {
				i = open
				continue
			}
			latex := strings.TrimSpace(content[open:close])
			formulas = append(formulas, MarkdownFormula{
				Latex: latex, Block: true, Start: i, End: close + 2,
			})
			i = close + 2
			continue
		}
		// inline：开 $ 后首字符非空白
		open := i + 1
		if open >= len(content) || content[open] == ' ' || content[open] == '\t' || content[open] == '\n' || masked[open] {
			i++
			continue
		}
		close := findUnescapedDollarPair(content, masked, open, false)
		if close < 0 {
			i = open
			continue
		}
		// 闭 $ 前末字符非空白
		if content[close-1] == ' ' || content[close-1] == '\t' || content[close-1] == '\n' {
			i = open
			continue
		}
		latex := strings.TrimSpace(content[open:close])
		formulas = append(formulas, MarkdownFormula{
			Latex: latex, Block: false, Start: i, End: close + 1,
		})
		i = close + 1
	}
	return formulas
}

// findUnescapedDollarPair 从 from 起找配对定界符。block=true 找 $$，否则找单个 $
// 且限同一行。掩码与 \$ 转义跳过。找不到返回 -1。
func findUnescapedDollarPair(content string, masked []bool, from int, block bool) int {
	j := from
	for j < len(content) {
		if masked[j] {
			j++
			continue
		}
		if content[j] == '\n' && !block {
			return -1
		}
		if content[j] == '$' && (j == 0 || content[j-1] != '\\') {
			if block {
				if j+1 < len(content) && content[j+1] == '$' && !masked[j+1] {
					return j
				}
				j++
				continue
			}
			// inline 遇 $$ 跳过两个（block 定界符不作 inline 配对）
			if j+1 < len(content) && content[j+1] == '$' {
				j += 2
				continue
			}
			if j > from && content[j-1] == '$' {
				j++
				continue
			}
			return j
		}
		j++
	}
	return -1
}
