package post

import (
	"strings"
	"testing"

	"golang.org/x/net/html"
)

func parseDoc(t *testing.T, raw string) *html.Node {
	t.Helper()
	doc, err := html.Parse(strings.NewReader(raw))
	if err != nil {
		t.Fatalf("html.Parse 失败: %v", err)
	}
	return doc
}

// TestExtractArticleTitle_OgTitle 验证 og:title 作为最高优先级来源。
func TestExtractArticleTitle_OgTitle(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head>
<meta property="og:title" content="真实文章标题">
<title>Yggdrasil Blog</title>
</head><body><article><h1>另一个 H1</h1></article></body></html>`)
	if got := extractArticleTitle(doc); got != "真实文章标题" {
		t.Errorf("期望 og:title，实际 %q", got)
	}
}

// TestExtractArticleTitle_FallbackToH1 验证无 og:title 时回退到正文 H1。
func TestExtractArticleTitle_FallbackToH1(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head><title>站点名</title></head>
<body><article><h1>正文 H1 标题</h1></article></body></html>`)
	if got := extractArticleTitle(doc); got != "正文 H1 标题" {
		t.Errorf("期望正文 H1，实际 %q", got)
	}
}

// TestExtractArticleTitle_FallbackToTitle 验证所有来源都缺失时兜底 <title>。
func TestExtractArticleTitle_FallbackToTitle(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head><title>只剩 title 标签</title></head><body></body></html>`)
	if got := extractArticleTitle(doc); got != "只剩 title 标签" {
		t.Errorf("期望 <title> 兜底，实际 %q", got)
	}
}

// TestExtractArticleTitle_JSONLD 验证 JSON-LD 的 name/headline 字段能被解析。
func TestExtractArticleTitle_JSONLD(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head>
<title>站点名</title>
<script type="application/ld+json">{"@type":"BlogPosting","headline":"JSON-LD 标题"}</script>
</head><body></body></html>`)
	if got := extractArticleTitle(doc); got != "JSON-LD 标题" {
		t.Errorf("期望 JSON-LD headline，实际 %q", got)
	}
}

// TestExtractArticleTitle_JSONLDArray 验证 JSON-LD 为数组时也能解析。
func TestExtractArticleTitle_JSONLDArray(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head>
<script type="application/ld+json">[{"@type":"BlogPosting","name":"数组里的标题"}]</script>
</head><body></body></html>`)
	if got := extractArticleTitle(doc); got != "数组里的标题" {
		t.Errorf("期望 JSON-LD 数组中的 name，实际 %q", got)
	}
}

// TestExtractSeoTitle_TwitterFirst 验证 SEO 标题优先 twitter:title，其次 og:title。
func TestExtractSeoTitle_TwitterFirst(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head>
<meta name="twitter:title" content="分享卡片标题">
<meta property="og:title" content="另一个 OG 标题">
</head></html>`)
	if got := extractSeoTitle(doc); got != "分享卡片标题" {
		t.Errorf("期望 twitter:title，实际 %q", got)
	}
}

// TestExtractSeoTitle_OgFallback 验证无 twitter:title 时回退 og:title。
func TestExtractSeoTitle_OgFallback(t *testing.T) {
	doc := parseDoc(t, `<!DOCTYPE html><html><head>
<meta property="og:title" content="OG 标题">
</head></html>`)
	if got := extractSeoTitle(doc); got != "OG 标题" {
		t.Errorf("期望 og:title，实际 %q", got)
	}
}

// TestExtractSeoDescription_Priority 验证 SEO 描述优先级：description → og:description → twitter:description。
func TestExtractSeoDescription_Priority(t *testing.T) {
	cases := []struct {
		name string
		html string
		want string
	}{
		{
			name: "meta description 优先",
			html: `<meta name="description" content="meta desc"><meta property="og:description" content="og desc">`,
			want: "meta desc",
		},
		{
			name: "无 meta description 时用 og:description",
			html: `<meta property="og:description" content="og desc"><meta name="twitter:description" content="tw desc">`,
			want: "og desc",
		},
		{
			name: "兜底 twitter:description",
			html: `<meta name="twitter:description" content="tw desc">`,
			want: "tw desc",
		},
		{
			name: "全部缺失返回空",
			html: `<title>x</title>`,
			want: "",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			doc := parseDoc(t, `<!DOCTYPE html><html><head>`+c.html+`</head></html>`)
			if got := extractSeoDescription(doc); got != c.want {
				t.Errorf("期望 %q，实际 %q", c.want, got)
			}
		})
	}
}
