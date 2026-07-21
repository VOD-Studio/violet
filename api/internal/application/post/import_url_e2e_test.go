package post

import (
	urlpkg "net/url"
	"strings"
	"testing"
	"time"

	readability "codeberg.org/readeck/go-readability/v2"
	"golang.org/x/net/html"
)

// TestImportURLPipeline_RuaPlusE2E 端到端验证真实 rua.plus URL 的公式还原。
// rua.plus 关闭了 KaTeX mathml 层（无 annotation 源码），且块级公式的 .katex-display
// wrapper 内部是纯装饰 span，会被 readability 当作空节点删除——这是 markBlockKaTeX 要解决的核心场景。
//
// 这是一个网络依赖测试，跑前要求能访问 rua.plus；CI/离线环境下自动跳过。
func TestImportURLPipeline_RuaPlusE2E(t *testing.T) {
	if testing.Short() {
		t.Skip("跳过网络依赖测试")
	}
	rawURL := "https://rua.plus/post/markdown-quan-te-xing-ce-shi-wen-zhang"
	resp, err := fetchHTML(rawURL, 15*time.Second)
	if err != nil {
		t.Skipf("无法访问 %s: %v（跳过）", rawURL, err)
	}
	defer resp.Body.Close()

	doc, err := html.Parse(resp.Body)
	if err != nil {
		t.Fatalf("html.Parse 失败: %v", err)
	}
	parsedURL, _ := urlpkg.ParseRequestURI(rawURL)

	preserveMathJaxScripts(doc)
	markBlockKaTeX(doc)

	p := readability.NewParser()
	p.KeepClasses = true
	art, err := p.ParseDocument(doc, parsedURL)
	if err != nil {
		t.Fatalf("ParseDocument 失败: %v", err)
	}
	if art.Node != nil {
		restoreMathNodes(art.Node)
	}

	var buf strings.Builder
	if err := art.RenderHTML(&buf); err != nil {
		t.Fatalf("RenderHTML 失败: %v", err)
	}
	out := buf.String()

	// rua.plus 关闭 mathml 层，所有公式都应还原为占位：
	// 块级（6 个，从 .katex-display wrapper 还原）→ $$ $$；行内（多个）→ $ $
	blockCount := strings.Count(out, "$$ $$")
	inlineCount := strings.Count(out, "$ $")
	t.Logf("块级公式占位 ($$ $$) 数量: %d", blockCount)
	t.Logf("行内公式占位 ($ $) 数量: %d", inlineCount)

	if blockCount == 0 {
		t.Errorf("期望块级公式还原为 $$ $$ 占位，实际未找到。输出片段:\n%s", truncateForLog(out, 2000))
	}
	if inlineCount == 0 {
		t.Errorf("期望行内公式还原为 $ $ 占位，实际未找到。输出片段:\n%s", truncateForLog(out, 2000))
	}
	// 不应有 KaTeX 渲染 DOM 残留（class="katex" 才算，标题文本里的 katex 字符串不算）
	if strings.Contains(out, `class="katex`) ||
		strings.Contains(out, "katex-html") ||
		strings.Contains(out, "katex-display") ||
		strings.Contains(out, "mathjax-legacy") {
		t.Errorf("公式 DOM 残留未清除。输出片段:\n%s", truncateForLog(out, 2000))
	}
}

func truncateForLog(s string, n int) string {
	if len(s) > n {
		return s[:n] + "...[truncated]"
	}
	return s
}
