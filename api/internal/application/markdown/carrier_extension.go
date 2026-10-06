package markdown

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"

	infracoderunner "blog-api/internal/infrastructure/coderunner"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer"
	gmhtml "github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

var (
	kindInlineMath = ast.NewNodeKind("VioletInlineMath")
	kindBlockMath  = ast.NewNodeKind("VioletBlockMath")
	kindHighlight  = ast.NewNodeKind("VioletHighlight")
)

type inlineMath struct {
	ast.BaseInline
	latex string
}

func (n *inlineMath) Kind() ast.NodeKind            { return kindInlineMath }
func (n *inlineMath) Dump(source []byte, level int) { ast.DumpHelper(n, source, level, nil, nil) }

type blockMath struct {
	ast.BaseBlock
	body   strings.Builder
	closed bool
}

func (n *blockMath) Kind() ast.NodeKind            { return kindBlockMath }
func (n *blockMath) Dump(source []byte, level int) { ast.DumpHelper(n, source, level, nil, nil) }
func (n *blockMath) IsRaw() bool                   { return true }

type highlight struct{ ast.BaseInline }

func (n *highlight) Kind() ast.NodeKind            { return kindHighlight }
func (n *highlight) Dump(source []byte, level int) { ast.DumpHelper(n, source, level, nil, nil) }

type mathInlineParser struct{}

func (mathInlineParser) Trigger() []byte { return []byte{'$'} }
func (mathInlineParser) Parse(parent ast.Node, reader text.Reader, pc parser.Context) ast.Node {
	line, _ := reader.PeekLine()
	// 转义与代码 span 由 Goldmark 处理。美元定界符内侧不能紧邻空白，
	// 闭定界符后不能紧邻数字，避免把普通货币串误识别为公式。
	if len(line) < 3 || line[1] == '$' || util.IsSpace(line[1]) || reader.PrecendingCharacter() == '$' {
		return nil
	}
	for i := 1; i < len(line) && line[i] != '\n'; i++ {
		if line[i] == '\\' {
			i++
			continue
		}
		if line[i] != '$' {
			continue
		}
		if util.IsSpace(line[i-1]) || (i+1 < len(line) && (line[i+1] == '$' || line[i+1] >= '0' && line[i+1] <= '9')) {
			return nil
		}
		reader.Advance(i + 1)
		return &inlineMath{latex: string(line[1:i])}
	}
	return nil
}

type mathBlockParser struct{}

func (mathBlockParser) Trigger() []byte { return []byte{'$'} }
func (mathBlockParser) Open(parent ast.Node, reader text.Reader, pc parser.Context) (ast.Node, parser.State) {
	line, _ := reader.PeekLine()
	pos := pc.BlockIndent()
	if pos < 0 || pos >= len(line) || !bytes.HasPrefix(line[pos:], []byte("$$")) {
		return nil, parser.NoChildren
	}
	rest := strings.TrimSpace(string(line[pos+2:]))
	n := &blockMath{}
	if end := strings.Index(rest, "$$"); end >= 0 {
		if strings.TrimSpace(rest[end+2:]) != "" {
			return nil, parser.NoChildren
		}
		n.body.WriteString(rest[:end])
		n.closed = true
	} else if rest != "" {
		n.body.WriteString(rest)
		n.body.WriteByte('\n')
	}
	reader.AdvanceToEOL()
	return n, parser.NoChildren
}
func (mathBlockParser) Continue(node ast.Node, reader text.Reader, pc parser.Context) parser.State {
	n := node.(*blockMath)
	if n.closed {
		return parser.Close
	}
	line, _ := reader.PeekLine()
	trimmed := bytes.TrimSpace(line)
	if bytes.Equal(trimmed, []byte("$$")) {
		reader.AdvanceToEOL()
		return parser.Close
	}
	n.body.Write(line)
	reader.AdvanceToEOL()
	return parser.Continue | parser.NoChildren
}
func (mathBlockParser) Close(node ast.Node, reader text.Reader, pc parser.Context) {}
func (mathBlockParser) CanInterruptParagraph() bool                                { return true }
func (mathBlockParser) CanAcceptIndentedLine() bool                                { return false }

type highlightDelimiter struct{}

func (highlightDelimiter) IsDelimiter(b byte) bool { return b == '=' }
func (highlightDelimiter) CanOpenCloser(opener, closer *parser.Delimiter) bool {
	return opener.Char == closer.Char
}
func (highlightDelimiter) OnMatch(consumes int) ast.Node { return &highlight{} }

type highlightParser struct{}

func (highlightParser) Trigger() []byte { return []byte{'='} }
func (highlightParser) Parse(parent ast.Node, reader text.Reader, pc parser.Context) ast.Node {
	line, segment := reader.PeekLine()
	before := reader.PrecendingCharacter()
	n := parser.ScanDelimiter(line, before, 2, highlightDelimiter{})
	if n == nil || n.OriginalLength != 2 || before == '=' {
		return nil
	}
	n.Segment = segment.WithStop(segment.Start + 2)
	reader.Advance(2)
	pc.PushDelimiter(n)
	return n
}

type carrierExtension struct{}

func (carrierExtension) Extend(m goldmark.Markdown) {
	m.Parser().AddOptions(
		parser.WithBlockParsers(util.Prioritized(mathBlockParser{}, 700)),
		parser.WithInlineParsers(util.Prioritized(mathInlineParser{}, 200), util.Prioritized(highlightParser{}, 500)),
	)
	m.Renderer().AddOptions(renderer.WithNodeRenderers(util.Prioritized(carrierRenderer{}, 100)))
}

type carrierRenderer struct{}

func (carrierRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(kindInlineMath, renderMath)
	reg.Register(kindBlockMath, renderMath)
	reg.Register(kindHighlight, renderHighlight)
	reg.Register(ast.KindFencedCodeBlock, renderFence)
}
func renderMath(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	switch n := node.(type) {
	case *inlineMath:
		_, _ = fmt.Fprintf(w, `<span data-type="inline-math" data-latex="%s"></span>`, util.EscapeHTML([]byte(n.latex)))
	case *blockMath:
		_, _ = fmt.Fprintf(w, "<div data-type=\"block-math\" data-latex=\"%s\"></div>\n", util.EscapeHTML([]byte(strings.TrimSpace(n.body.String()))))
	}
	return ast.WalkSkipChildren, nil
}
func renderHighlight(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if entering {
		_, _ = w.WriteString("<mark>")
	} else {
		_, _ = w.WriteString("</mark>")
	}
	return ast.WalkContinue, nil
}
func renderFence(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	if !entering {
		return ast.WalkContinue, nil
	}
	n := node.(*ast.FencedCodeBlock)
	info := ""
	if n.Info != nil {
		info = string(n.Info.Value(source))
	}
	lang, runnable, overrides := infracoderunner.ParseFenceInfo(info)
	code := n.Lines().Value(source)
	body := bytes.TrimSuffix(code, []byte("\n"))
	if lang == "mermaid" {
		_, _ = fmt.Fprintf(w, "<div data-type=\"diagram-block\" data-format=\"mermaid\" data-source=\"%s\"></div>\n", util.EscapeHTML(body))
		return ast.WalkSkipChildren, nil
	}
	_, _ = w.WriteString("<pre")
	if runnable {
		_, _ = fmt.Fprintf(w, ` data-runnable="true" data-lang="%s" data-source="%s"`, util.EscapeHTML([]byte(lang)), util.EscapeHTML(body))
		if overrides != nil {
			encoded, err := json.Marshal(overrides)
			if err != nil {
				return ast.WalkStop, err
			}
			_, _ = fmt.Fprintf(w, ` data-overrides="%s"`, util.EscapeHTML(encoded))
		}
	}
	_, _ = w.WriteString("><code")
	if language := n.Language(source); len(language) != 0 {
		_, _ = fmt.Fprintf(w, ` class="language-%s"`, util.EscapeHTML(language))
	}
	_, _ = w.WriteString(">")
	gmhtml.DefaultWriter.RawWrite(w, code)
	_, _ = w.WriteString("</code></pre>\n")
	return ast.WalkSkipChildren, nil
}
