package post

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"golang.org/x/net/html"

	domainsettings "blog-api/internal/domain/settings"
)

// fakeSettingsStore 内存版 SettingsStore，测试用。
type fakeSettingsStore struct {
	m map[string]string
}

func (f *fakeSettingsStore) GetAll(ctx context.Context) (map[string]string, error) {
	return f.m, nil
}
func (f *fakeSettingsStore) Upsert(ctx context.Context, key, value string) error {
	f.m[key] = value
	return nil
}
func (f *fakeSettingsStore) UpsertMany(ctx context.Context, kvs map[string]string) error {
	for k, v := range kvs {
		f.m[k] = v
	}
	return nil
}

var _ domainsettings.SettingsStore = (*fakeSettingsStore)(nil)

// TestParseAIRestoreResponse_PureJSON 验证纯 JSON 数组解析。
func TestParseAIRestoreResponse_PureJSON(t *testing.T) {
	raw := `[{"id":1,"latex":"E=mc^2"},{"id":2,"latex":"a^2+b^2=c^2"}]`
	result, err := parseAIRestoreResponse(raw)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if result[1] != "E=mc^2" || result[2] != "a^2+b^2=c^2" {
		t.Errorf("解析结果不匹配: %+v", result)
	}
}

// TestParseAIRestoreResponse_MarkdownWrapped 验证被 ```json ... ``` 包裹的响应。
func TestParseAIRestoreResponse_MarkdownWrapped(t *testing.T) {
	raw := "```json\n[{\"id\":1,\"latex\":\"\\\\sum_{i=1}^n i\"}]\n```"
	result, err := parseAIRestoreResponse(raw)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if result[1] != "\\sum_{i=1}^n i" {
		t.Errorf("期望 \\sum_{i=1}^n i，实际 %q", result[1])
	}
}

// TestParseAIRestoreResponse_ExtraText 验证 LLM 加前后废话时仍能提取。
func TestParseAIRestoreResponse_ExtraText(t *testing.T) {
	raw := `好的，以下是还原结果：
[{"id":1,"latex":"x^2"}]
希望对你有帮助。`
	result, err := parseAIRestoreResponse(raw)
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if result[1] != "x^2" {
		t.Errorf("期望 x^2，实际 %q", result[1])
	}
}

// TestParseAIRestoreResponse_NoArray 验证无 JSON 数组时返回错误。
func TestParseAIRestoreResponse_NoArray(t *testing.T) {
	_, err := parseAIRestoreResponse("抱歉，我无法处理")
	if err == nil {
		t.Fatal("期望错误")
	}
}

// TestRestoreFormulasWithAI_Success 端到端验证：mock OpenAI 端点返回 LaTeX，验证占位被替换。
func TestRestoreFormulasWithAI_Success(t *testing.T) {
	// mock OpenAI 端点
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 解析请求体提取 formulaText（简单 echo，生产用 LLM 真实推理）
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		// 无论输入是什么，返回固定 LaTeX（id=1 → E=mc^2）
		resp := `{"choices":[{"message":{"content":"[{\"id\":1,\"latex\":\"E=mc^2\"}]"}}]}`
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(resp))
	}))
	defer srv.Close()

	store := &fakeSettingsStore{m: map[string]string{
		"llm_protocol": "openai",
		"llm_api_key":  "test-key",
		"llm_api_url":  srv.URL,
		"llm_model":    "test-model",
	}}
	svc := &Service{settingsStore: store}

	// 构造一个含「无源码 formulaText」占位的 article
	htmlDoc := wrapArticle(`<p>公式：<span class="mathjax-legacy" data-mj-formula-text="E = mc²">FORMULA</span></p>`)
	doc := parseDoc(t, htmlDoc)

	warnings := svc.restoreFormulasWithAI(context.Background(), doc)
	if len(warnings) != 0 {
		t.Errorf("期望无 warnings，实际 %v", warnings)
	}

	// 验证占位被替换成 $E=mc^2$
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	if !strings.Contains(buf.String(), "$E=mc^2$") {
		t.Errorf("期望含 $E=mc^2$，实际 %q", buf.String())
	}
}

// TestRestoreFormulasWithAI_NotConfigured 验证 LLM 未配置时降级为空占位。
func TestRestoreFormulasWithAI_NotConfigured(t *testing.T) {
	svc := &Service{settingsStore: nil} // 未注入 store
	htmlDoc := wrapArticle(`<p>公式：<span class="mathjax-legacy" data-mj-formula-text="E = mc²">FORMULA</span></p>`)
	doc := parseDoc(t, htmlDoc)

	warnings := svc.restoreFormulasWithAI(context.Background(), doc)
	if len(warnings) != 1 {
		t.Fatalf("期望 1 个 warning，实际 %d", len(warnings))
	}
	if !strings.Contains(warnings[0], "未启用") {
		t.Errorf("warning 应含 '未启用'，实际 %q", warnings[0])
	}
	// 验证降级为空占位
	var buf strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			buf.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	if !strings.Contains(buf.String(), "$ $") {
		t.Errorf("期望含空占位 $ $，实际 %q", buf.String())
	}
}

// TestRestoreFormulasWithAI_LLMError 验证 LLM 调用失败时降级。
func TestRestoreFormulasWithAI_LLMError(t *testing.T) {
	// mock 一个返回 500 错误的端点
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"server error"}}`))
	}))
	defer srv.Close()

	store := &fakeSettingsStore{m: map[string]string{
		"llm_api_key": "k",
		"llm_api_url": srv.URL,
		"llm_model":   "m",
	}}
	svc := &Service{settingsStore: store}
	htmlDoc := wrapArticle(`<p>公式：<span class="mathjax-legacy" data-mj-formula-text="x²">FORMULA</span></p>`)
	doc := parseDoc(t, htmlDoc)

	warnings := svc.restoreFormulasWithAI(context.Background(), doc)
	if len(warnings) != 1 {
		t.Fatalf("期望 1 个 warning，实际 %d", len(warnings))
	}
	if !strings.Contains(warnings[0], "调用失败") {
		t.Errorf("warning 应含 '调用失败'，实际 %q", warnings[0])
	}
}
