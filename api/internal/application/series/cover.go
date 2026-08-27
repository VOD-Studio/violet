package series

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	appmedia "blog-api/internal/application/media"
	"blog-api/internal/domain/shared"
)

// CoverGenerator 生图端口：由 infrastructure/llm 适配（OpenAI images 协议）。
type CoverGenerator interface {
	GenerateImages(ctx context.Context, prompt string, n int) ([]GeneratedImage, error)
}

// GeneratedImage 单张生成结果。
type GeneratedImage struct {
	B64 string // 图像字节 base64；优先消费方
	URL string // 兼容端点直接给临时 URL 的形态
}

// GeneratedCoverStore 生成封面的素材库落库端口：由 media 域适配，
// 落 purpose=material 并复用引用计数/缩略图机制。
type GeneratedCoverStore interface {
	SaveGeneratedCover(ctx context.Context, ownerID shared.ID, data []byte) (string, error)
}

const defaultCoverCount = 2

// GenerateCoverSuggestions 为书生成 AI 封面候选。
//
// prompt 默认由书名+简介构造，传入 customPrompt 时整体替换；
// 返回站内 URL 列表供前端挑选——不直接改动书封面，选定走 PATCH Update
// （封面变更必须显式）。generator/store 未注入 = 站点 LLM 未配置，
// 返回「未配置」错误供 UI 置灰降级；端点错误原样透传展示。
func (s *Service) GenerateCoverSuggestions(ctx context.Context, id, userID, customPrompt string, n int) ([]string, error) {
	if s.coverGenerator == nil || s.coverStore == nil {
		// 领域错误映射 400：前端据此展示「未配置」而非 500
		return nil, shared.BadRequest("AI 生图未配置：请先在站点设置填写 llm_api_key 与 llm_image_model")
	}
	sid, err := shared.ParseID(id)
	if err != nil {
		return nil, err
	}
	if _, err := shared.ParseID(userID); err != nil {
		return nil, err
	}
	series, err := s.loadOwned(ctx, sid, userID)
	if err != nil {
		return nil, err
	}
	if n <= 0 {
		n = defaultCoverCount
	}

	prompt := strings.TrimSpace(customPrompt)
	if prompt == "" {
		prompt = fmt.Sprintf("为技术书籍《%s》设计一张简洁的竖版封面，主题：%s。要求抽象几何、低饱和、无文字。",
			series.Title(), series.Description())
	}

	images, err := s.coverGenerator.GenerateImages(ctx, prompt, n)
	if err != nil {
		// 端点错误透传（含状态码），前端据此提示「端点不支持/配额不足」等
		return nil, err
	}
	urls := make([]string, 0, len(images))
	for _, img := range images {
		data, decodeErr := decodeImagePayload(img)
		if decodeErr != nil {
			continue
		}
		uid, _ := shared.ParseID(userID)
		url, saveErr := s.coverStore.SaveGeneratedCover(ctx, uid, data)
		if saveErr != nil {
			return nil, fmt.Errorf("落素材库失败: %w", saveErr)
		}
		urls = append(urls, url)
	}
	if len(urls) == 0 {
		return nil, shared.BadRequest("端点未返回可用图像")
	}
	return urls, nil
}

// decodeImagePayload 提取并校验图像字节；b64 优先。URL 形态（临时外链）
// 当前不落库，仅兼容保留字段——统一 b64 端点不受影响。
//
// 格式按字节 magic bytes 嗅探（media.SniffImageExt，落库侧会再嗅探一次）：
// LLM 端点（gpt-image-1 等）可能返回 jpeg/webp，嗅探失败视为不可用图跳过。
func decodeImagePayload(img GeneratedImage) ([]byte, error) {
	if img.B64 == "" {
		return nil, fmt.Errorf("端点未返回 b64 图像数据")
	}
	data, err := base64.StdEncoding.DecodeString(img.B64)
	if err != nil {
		return nil, fmt.Errorf("b64 解码失败: %w", err)
	}
	if _, ok := appmedia.SniffImageExt(data); !ok {
		return nil, fmt.Errorf("生成结果不是支持的图片格式（png/jpg/webp）")
	}
	return data, nil
}

// GenerateCoverStandalone 独立生图（建书流程的创建态）：书尚未落库，
// prompt 由调用方直接传入（前端用表单当前书名/简介构造）。
// 与 GenerateCoverSuggestions 共享落库与降级语义；不涉及书归属校验。
func (s *Service) GenerateCoverStandalone(ctx context.Context, userID, prompt string, n int) ([]string, error) {
	if s.coverGenerator == nil || s.coverStore == nil {
		return nil, shared.BadRequest("AI 生图未配置：请先在站点设置填写 llm_api_key 与 llm_image_model")
	}
	if strings.TrimSpace(prompt) == "" {
		return nil, shared.BadRequest("生图 prompt 不能为空")
	}
	if n <= 0 {
		n = defaultCoverCount
	}
	uid, err := shared.ParseID(userID)
	if err != nil {
		return nil, err
	}
	images, err := s.coverGenerator.GenerateImages(ctx, strings.TrimSpace(prompt), n)
	if err != nil {
		return nil, err
	}
	urls := make([]string, 0, len(images))
	for _, img := range images {
		data, decodeErr := decodeImagePayload(img)
		if decodeErr != nil {
			continue
		}
		url, saveErr := s.coverStore.SaveGeneratedCover(ctx, uid, data)
		if saveErr != nil {
			return nil, fmt.Errorf("落素材库失败: %w", saveErr)
		}
		urls = append(urls, url)
	}
	if len(urls) == 0 {
		return nil, shared.BadRequest("端点未返回可用图像")
	}
	return urls, nil
}
