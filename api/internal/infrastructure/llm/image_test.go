package llm

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

)

// fakeImagesServer 模拟 OpenAI images API：校验路径与请求体，返回一张 b64 图。
func fakeImagesServer(t *testing.T, gotPath *string, gotPrompt *string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*gotPath = r.URL.Path
		var body struct {
			Prompt string `json:"prompt"`
			N      int    `json:"n"`
			Model  string `json:"model"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		*gotPrompt = body.Prompt
		png := []byte{0x89, 'P', 'N', 'G'}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"created": 1700000000,
			"data": []map[string]string{
				{"b64_json": base64.StdEncoding.EncodeToString(png)},
				{"b64_json": base64.StdEncoding.EncodeToString(png)},
			},
		})
	}))
}

func TestOpenAIClient_GenerateImage_Success(t *testing.T) {
	gotPath, gotPrompt := "", ""
	server := fakeImagesServer(t, &gotPath, &gotPrompt)
	defer server.Close()

	client := NewOpenAIClient("test-key", server.URL, "text-model")
	resp, err := client.GenerateImage(context.Background(), GenerateImageRequest{
		Prompt: "书籍封面",
		Model:  "gpt-image-1",
		N:      2,
	})
	if err != nil {
		t.Fatalf("GenerateImage() error = %v", err)
	}
	if gotPath != "/images/generations" {
		t.Errorf("path = %q, want /images/generations", gotPath)
	}
	if !strings.Contains(gotPrompt, "书籍封面") {
		t.Errorf("prompt = %q", gotPrompt)
	}
	if len(resp) != 2 {
		t.Fatalf("len(data) = %d, want 2", len(resp))
	}
	if _, err := base64.StdEncoding.DecodeString(resp[0].B64); err != nil {
		t.Errorf("b64 解码失败: %v", err)
	}
}

func TestGenerateImage_ValidatesParams(t *testing.T) {
	client := NewOpenAIClient("key", "http://unused", "m")
	if _, err := client.GenerateImage(context.Background(), GenerateImageRequest{Prompt: ""}); err == nil {
		t.Error("空 prompt 应拒绝")
	}
	if _, err := client.GenerateImage(context.Background(), GenerateImageRequest{Prompt: "封面", N: 11}); err == nil {
		t.Error("n>10 应拒绝")
	}
}

func TestNewClientFromSettings_ImageFallback(t *testing.T) {
	m := map[string]string{
		"llm_api_key":     "k",
		"llm_api_url":     "http://x/v1",
		"llm_model":       "gpt-4o",
		"llm_image_model": "dall-e-3",
	}
	client, err := NewClientFromSettings(m)
	if err != nil {
		t.Fatalf("factory error = %v", err)
	}
	oai, ok := client.(*OpenAIClient)
	if !ok {
		t.Fatalf("类型断言失败")
	}
	if oai.defaultImageModel != "dall-e-3" {
		t.Errorf("defaultImageModel = %q", oai.defaultImageModel)
	}
}
