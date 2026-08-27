package app

import (
	"context"
	"fmt"

	appmedia "blog-api/internal/application/media"
	appseries "blog-api/internal/application/series"
	appshared "blog-api/internal/application/shared"
	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	infrallm "blog-api/internal/infrastructure/llm"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	serieshttp "blog-api/internal/interfaces/http/handler/series"

	"gorm.io/gorm"
)

type SeriesContainer struct {
	SeriesHandler *serieshttp.Handler
	SeriesService *appseries.Service
}

// NewSeriesContainer 装配系列书模块（PRD-0021）。
//
// 章节归属直接落在 posts 三列（migration 102），仓储跨表读写，
// 不依赖 post 域应用层；bus 发布 series.* 事件（审计订阅者消费）。
func NewSeriesContainer(db *gorm.DB, bus appshared.EventBus, settingsStore domainsettings.SettingsStore, uploadSvc *appmedia.UploadService) *SeriesContainer {
	repo := gormrepo.NewSeriesRepository(db)
	svc := appseries.NewService(repo, bus)
	// AI 封面依赖可空注入：站点未配 llm_* 时 GenerateCoverSuggestions 降级置灰。
	if settingsStore != nil && uploadSvc != nil {
		svc.SetCoverDeps(
			&LLMCoverGenerator{settings: settingsStore},
			&MediaGeneratedCoverStore{uploadSvc: uploadSvc},
		)
	}
	return &SeriesContainer{
		SeriesHandler: serieshttp.NewHandler(svc),
		SeriesService: svc,
	}
}

// LLMCoverGenerator series.CoverGenerator 的 LLM 适配器：
// 每次调用从 site_settings 构造 OpenAI 协议客户端（配置热更新免重启），
// 再走 images API 生成。
type LLMCoverGenerator struct{ settings domainsettings.SettingsStore }

func (g *LLMCoverGenerator) GenerateImages(ctx context.Context, prompt string, n int) ([]appseries.GeneratedImage, error) {
	m, err := g.settings.GetAll(ctx)
	if err != nil {
		return nil, fmt.Errorf("读取站点设置失败: %w", err)
	}
	client, err := infrallm.NewClientFromSettings(m)
	if err != nil {
		return nil, err
	}
	oai, ok := client.(*infrallm.OpenAIClient)
	if !ok {
		return nil, fmt.Errorf("当前 LLM 协议不支持生图")
	}
	imgs, err := oai.GenerateImage(ctx, infrallm.GenerateImageRequest{Prompt: prompt, N: n})
	if err != nil {
		return nil, err
	}
	out := make([]appseries.GeneratedImage, 0, len(imgs))
	for _, img := range imgs {
		out = append(out, appseries.GeneratedImage{B64: img.B64})
	}
	return out, nil
}

// MediaGeneratedCoverStore series.GeneratedCoverStore 的 media 域适配器，
// 落 purpose=material 复用素材库缩略图与去重机制。
type MediaGeneratedCoverStore struct{ uploadSvc *appmedia.UploadService }

func (s *MediaGeneratedCoverStore) SaveGeneratedCover(ctx context.Context, ownerID shared.ID, data []byte, ext string) (string, error) {
	return s.uploadSvc.SaveGeneratedCover(ctx, ownerID, data, ext)
}
