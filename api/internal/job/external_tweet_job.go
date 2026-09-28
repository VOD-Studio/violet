package job

import (
	"context"
	"time"

	"blog-api/internal/application/tweet"
	"github.com/rs/zerolog/log"
)

type ExternalTweetJob struct{ service *tweet.ExternalService }

func NewExternalTweetJob(service *tweet.ExternalService) *ExternalTweetJob {
	return &ExternalTweetJob{service: service}
}

func (j *ExternalTweetJob) Start(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for {
		checked, failed, cleaned, err := j.service.Maintain(ctx)
		if err != nil && ctx.Err() == nil {
			log.Warn().Err(err).Msg("X 原文维护失败")
		}
		if checked > 0 || cleaned > 0 {
			log.Info().Int("checked", checked).Int("failed", failed).Int("cleaned", cleaned).Msg("X 原文维护完成")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
