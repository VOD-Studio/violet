package llm

import (
	"context"
	"errors"
	"fmt"

	"github.com/openai/openai-go"
)

// GenerateImageRequest 文生图请求入参。
type GenerateImageRequest struct {
	// Prompt 画面描述（必填）。
	Prompt string
	// Model 生图模型；为空时用 llm_image_model 配置，再为空则 SDK 默认。
	Model string
	// 生成张数 1-10；为 0 时按 1 处理。
	N int
}

// GeneratedImage 单张生成结果。B64 为图像字节的 base64 编码。
type GeneratedImage struct {
	B64           string
	RevisedPrompt string
	URL           string
}

const maxGenerateImages = 10

// GenerateImage 调 OpenAI images 协议（POST /images/generations）批量生图。
//
// 兼容声明该协议的端点（OpenAI 官方、智谱 CogView 等）；纯文本端点返回非 2xx，
// 调用方据此置灰降级，不重试。统一请求 b64_json：URL 形态是临时链接且
// gpt-image-1 不支持 URL 返回。
func (c *OpenAIClient) GenerateImage(ctx context.Context, req GenerateImageRequest) ([]GeneratedImage, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("LLM API key 未配置")
	}
	if req.Prompt == "" {
		return nil, fmt.Errorf("生图 prompt 不能为空")
	}
	n := int64(req.N)
	if n <= 0 {
		n = 1
	}
	if n > maxGenerateImages {
		return nil, fmt.Errorf("单次最多生成 %d 张", maxGenerateImages)
	}
	model := req.Model
	if model == "" {
		model = c.defaultImageModel
	}

	resp, err := c.client.Images.Generate(ctx, openai.ImageGenerateParams{
		Prompt:         req.Prompt,
		N:              openai.Int(n),
		Model:          openai.ImageModel(model), // ImageModel 是 string 别名，空值由端点定默认
		ResponseFormat: openai.ImageGenerateParamsResponseFormatB64JSON,
	})
	if err != nil {
		var apiErr *openai.Error
		if errors.As(err, &apiErr) {
			return nil, fmt.Errorf("生图接口返回 %d: %s", apiErr.StatusCode, apiErr.Message)
		}
		return nil, fmt.Errorf("生图请求失败: %w", err)
	}
	out := make([]GeneratedImage, 0, len(resp.Data))
	for _, img := range resp.Data {
		out = append(out, GeneratedImage{B64: img.B64JSON, RevisedPrompt: img.RevisedPrompt, URL: img.URL})
	}
	return out, nil
}
