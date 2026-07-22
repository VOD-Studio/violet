package llm

import (
	"fmt"
	"strings"
)

// Config LLM 客户端构造配置。
//
// 字段语义对齐 site_settings 的 llm_* 键：
//   - Protocol: 协议标识，当前仅 "openai"（空值视为 openai）
//   - APIKey:   API 密钥（必填）
//   - APIURL:   Base URL（OpenAI 协议留空走官方端点）
//   - Model:    默认模型名
type Config struct {
	Protocol string
	APIKey   string
	APIURL   string
	Model    string
}

// NewClientFromConfig 按 Protocol 返回对应协议的客户端实现。
//
// 当前仅支持 openai 协议。新增 anthropic 等协议时在此分支扩展。
// APIKey 为空返回错误，调用方应据此判断「LLM 未启用」。
func NewClientFromConfig(cfg Config) (Client, error) {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return nil, fmt.Errorf("LLM API key 未配置")
	}
	protocol := strings.ToLower(strings.TrimSpace(cfg.Protocol))
	if protocol == "" {
		protocol = "openai"
	}
	switch protocol {
	case "openai":
		return NewOpenAIClient(cfg.APIKey, cfg.APIURL, cfg.Model), nil
	default:
		return nil, fmt.Errorf("不支持的 LLM 协议: %s", protocol)
	}
}

// NewClientFromSettings 从 site_settings 的 map 形态构造客户端。
//
// key 命名契约：llm_protocol / llm_api_key / llm_api_url / llm_model。
// 业务方读取 site_settings 后直接传入即可，无需手工拼 Config。
func NewClientFromSettings(m map[string]string) (Client, error) {
	return NewClientFromConfig(Config{
		Protocol: m["llm_protocol"],
		APIKey:   m["llm_api_key"],
		APIURL:   m["llm_api_url"],
		Model:    m["llm_model"],
	})
}
