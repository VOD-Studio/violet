package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestOpenAIClient_Success 验证正常响应能解析出 content，且请求体格式符合 OpenAI 协议。
func TestOpenAIClient_Success(t *testing.T) {
	var gotAuth string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// SDK 默认会请求 /chat/completions（baseURL 后拼接）
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			t.Errorf("请求路径应以 /chat/completions 结尾，实际 %s", r.URL.Path)
		}
		gotAuth = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		resp := `{"choices":[{"message":{"content":"E=mc^2"}}]}`
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(resp))
	}))
	defer srv.Close()

	client := NewOpenAIClient("test-key", srv.URL, "gpt-4o-mini")
	out, err := client.Complete(context.Background(), CompleteRequest{
		SystemPrompt: "你是公式还原助手",
		UserPrompt:   "E = mc²",
	})
	if err != nil {
		t.Fatalf("Complete 失败: %v", err)
	}
	if out.Content != "E=mc^2" {
		t.Errorf("期望 content 'E=mc^2'，实际 %q", out.Content)
	}
	if gotAuth != "Bearer test-key" {
		t.Errorf("Authorization 应为 'Bearer test-key'，实际 %q", gotAuth)
	}
	if gotBody["model"] != "gpt-4o-mini" {
		t.Errorf("model 应为 gpt-4o-mini，实际 %v", gotBody["model"])
	}
	msgs, ok := gotBody["messages"].([]any)
	if !ok || len(msgs) != 2 {
		t.Errorf("messages 应有 2 条，实际 %v", gotBody["messages"])
	}
}

// TestOpenAIClient_RequestModelOverride 验证 CompleteRequest.Model 覆盖默认模型。
func TestOpenAIClient_RequestModelOverride(t *testing.T) {
	var gotModel string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		if m, ok := body["model"].(string); ok {
			gotModel = m
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer srv.Close()

	client := NewOpenAIClient("k", srv.URL, "default-model")
	_, _ = client.Complete(context.Background(), CompleteRequest{
		UserPrompt: "hi",
		Model:      "override-model",
	})
	if gotModel != "override-model" {
		t.Errorf("期望 override-model，实际 %q", gotModel)
	}
}

// TestOpenAIClient_ErrorStatus 验证 HTTP 错误状态码被正确包装。
func TestOpenAIClient_ErrorStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"Invalid API key","type":"invalid_request_error"}}`))
	}))
	defer srv.Close()

	client := NewOpenAIClient("bad-key", srv.URL, "m")
	_, err := client.Complete(context.Background(), CompleteRequest{UserPrompt: "x"})
	if err == nil {
		t.Fatal("期望错误，实际 nil")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("错误应含状态码 401，实际 %v", err)
	}
}

// TestOpenAIClient_EmptyChoices 验证空 choices 返回错误。
func TestOpenAIClient_EmptyChoices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer srv.Close()

	client := NewOpenAIClient("k", srv.URL, "m")
	_, err := client.Complete(context.Background(), CompleteRequest{UserPrompt: "x"})
	if err == nil || !strings.Contains(err.Error(), "无 choices") {
		t.Errorf("期望 '无 choices' 错误，实际 %v", err)
	}
}

// TestOpenAIClient_NoAPIKey 验证空 key 立即报错，不发请求。
func TestOpenAIClient_NoAPIKey(t *testing.T) {
	client := NewOpenAIClient("", "https://example.com", "m")
	_, err := client.Complete(context.Background(), CompleteRequest{UserPrompt: "x"})
	if err == nil || !strings.Contains(err.Error(), "API key 未配置") {
		t.Errorf("期望 'API key 未配置' 错误，实际 %v", err)
	}
}

// TestNewClientFromConfig 验证 factory 按协议分派。
func TestNewClientFromConfig(t *testing.T) {
	t.Run("空 key 返回错误", func(t *testing.T) {
		_, err := NewClientFromConfig(Config{Protocol: "openai"})
		if err == nil {
			t.Fatal("期望错误")
		}
	})
	t.Run("openai 协议返回 OpenAIClient", func(t *testing.T) {
		c, err := NewClientFromConfig(Config{Protocol: "openai", APIKey: "k"})
		if err != nil {
			t.Fatalf("意外的错误: %v", err)
		}
		if _, ok := c.(*OpenAIClient); !ok {
			t.Errorf("期望 *OpenAIClient，实际 %T", c)
		}
	})
	t.Run("空 protocol 默认走 openai", func(t *testing.T) {
		c, err := NewClientFromConfig(Config{APIKey: "k"})
		if err != nil {
			t.Fatalf("意外的错误: %v", err)
		}
		if _, ok := c.(*OpenAIClient); !ok {
			t.Errorf("空 protocol 应默认 openai，实际 %T", c)
		}
	})
	t.Run("未知协议报错", func(t *testing.T) {
		_, err := NewClientFromConfig(Config{Protocol: "anthropic", APIKey: "k"})
		if err == nil || !strings.Contains(err.Error(), "不支持") {
			t.Errorf("期望 '不支持' 错误，实际 %v", err)
		}
	})
}

// TestNewClientFromSettings 验证从 site_settings map 构造。
func TestNewClientFromSettings(t *testing.T) {
	t.Run("完整配置构造成功", func(t *testing.T) {
		c, err := NewClientFromSettings(map[string]string{
			"llm_protocol": "openai",
			"llm_api_key":  "sk-xxx",
			"llm_api_url":  "https://api.deepseek.com/v1",
			"llm_model":    "deepseek-chat",
		})
		if err != nil {
			t.Fatalf("意外的错误: %v", err)
		}
		oc, ok := c.(*OpenAIClient)
		if !ok {
			t.Fatalf("期望 *OpenAIClient，实际 %T", c)
		}
		if oc.apiKey != "sk-xxx" {
			t.Errorf("apiKey 不匹配: %s", oc.apiKey)
		}
		if oc.baseURL != "https://api.deepseek.com/v1" {
			t.Errorf("baseURL 不匹配: %s", oc.baseURL)
		}
		if oc.defaultModel != "deepseek-chat" {
			t.Errorf("defaultModel 不匹配: %s", oc.defaultModel)
		}
	})
	t.Run("缺 key 报错", func(t *testing.T) {
		_, err := NewClientFromSettings(map[string]string{
			"llm_protocol": "openai",
		})
		if err == nil {
			t.Fatal("期望错误")
		}
	})
}
