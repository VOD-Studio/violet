// Package llm 提供大语言模型客户端的抽象与实现。
//
// 定义统一的 Client 接口，业务方（如 import-url 公式还原）通过依赖注入获取客户端，
// 具体协议实现（openai、未来的 anthropic）对调用方透明。配置来自 site_settings 的 llm_* 字段。
//
// 当前仅实现 OpenAI 协议（兼容 OpenAI/DeepSeek/Moonshot/通义/智谱/Ollama/vLLM 等端点）。
package llm

import "context"

// Client LLM 客户端抽象。
//
// Complete 发起一次非流式补全请求，返回模型生成的文本。
// 各协议实现（OpenAI、未来 Anthropic 等）实现此接口，业务方不感知协议差异。
type Client interface {
	Complete(ctx context.Context, req CompleteRequest) (CompleteResponse, error)
}

// CompleteRequest 补全请求入参。
type CompleteRequest struct {
	// SystemPrompt 系统提示词（角色/约束）。
	SystemPrompt string
	// UserPrompt 用户输入。
	UserPrompt string
	// Model 指定模型；为空时由实现使用自身的默认模型。
	Model string
}

// CompleteResponse 补全响应。
type CompleteResponse struct {
	// Content 模型生成的文本（已 trim）。
	Content string
}
