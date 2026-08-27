package llm

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// OpenAIClient 基于 openai-go 官方 SDK 的客户端实现。
//
// 兼容所有遵循 OpenAI 协议的端点：OpenAI 官方、DeepSeek、Moonshot、通义千问、智谱、
// Ollama、vLLM 等。baseURL 应指向 /v1 父目录（如 https://api.openai.com/v1），
// SDK 会自动拼接 /chat/completions。错误处理、超时、JSON 解析全部由 SDK 接管。
type OpenAIClient struct {
	apiKey       string
	baseURL      string // 不以 / 结尾；空串走 SDK 默认（OpenAI 官方）
	defaultModel string
	// defaultImageModel GenerateImage 未显式传 Model 时的兜底。
	defaultImageModel string
	client            openai.Client
 }
 
// NewOpenAIClient 构造 OpenAI 协议客户端。
//
// baseURL 为空时由 SDK 走 OpenAI 官方端点。defaultModel 为 CompleteRequest.Model 留空时的兜底。
 func NewOpenAIClient(apiKey, baseURL, defaultModel string) *OpenAIClient {
	return NewOpenAIClientWithImageModel(apiKey, baseURL, defaultModel, "")
}

// NewOpenAIClientWithImageModel 同上，额外接收生图模型兜底（llm_image_model）。
func NewOpenAIClientWithImageModel(apiKey, baseURL, defaultModel, defaultImageModel string) *OpenAIClient {
	baseURL = strings.TrimRight(baseURL, "/")
	opts := []option.RequestOption{option.WithAPIKey(apiKey)}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	return &OpenAIClient{
		apiKey:       apiKey,
		baseURL:      baseURL,
		defaultModel: defaultModel,
		defaultImageModel: defaultImageModel,
		client:       openai.NewClient(opts...),
	}
 }


// Complete 发起一次非流式 chat completion 请求。
//
// 错误透传 SDK 返回的 *openai.Error（含状态码与原始响应体），调用方可 errors.As 提取。
func (c *OpenAIClient) Complete(ctx context.Context, req CompleteRequest) (CompleteResponse, error) {
	if c.apiKey == "" {
		return CompleteResponse{}, fmt.Errorf("LLM API key 未配置")
	}
	model := req.Model
	if model == "" {
		model = c.defaultModel
	}
	if model == "" {
		return CompleteResponse{}, fmt.Errorf("LLM 模型未指定")
	}

	messages := make([]openai.ChatCompletionMessageParamUnion, 0, 2)
	if req.SystemPrompt != "" {
		messages = append(messages, openai.SystemMessage(req.SystemPrompt))
	}
	messages = append(messages, openai.UserMessage(req.UserPrompt))

	resp, err := c.client.Chat.Completions.New(ctx, openai.ChatCompletionNewParams{
		Model:    model,
		Messages: messages,
	})
	if err != nil {
		// SDK 的 *openai.Error 自带 Error()，含状态码+原始 body；直接透传
		var apiErr *openai.Error
		if errors.As(err, &apiErr) {
			return CompleteResponse{}, fmt.Errorf("LLM 接口返回 %d: %s", apiErr.StatusCode, apiErr.Message)
		}
		return CompleteResponse{}, fmt.Errorf("LLM 请求失败: %w", err)
	}
	if len(resp.Choices) == 0 {
		return CompleteResponse{}, fmt.Errorf("LLM 响应无 choices")
	}
	content := strings.TrimSpace(resp.Choices[0].Message.Content)
	return CompleteResponse{Content: content}, nil
}
