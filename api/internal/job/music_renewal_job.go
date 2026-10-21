package job

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"blog-api/internal/application/music"
)

type MusicRenewalJob struct{ service *music.Service }

func NewMusicRenewalJob(service *music.Service) *MusicRenewalJob {
	return &MusicRenewalJob{service: service}
}

// Start 每 24 小时续期一次，首次等待一个周期，随 ctx 取消退出。
func (j *MusicRenewalJob) Start(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if ctx.Err() != nil {
				return
			}
			if err := j.service.RefreshIfConnected(ctx); err != nil && ctx.Err() == nil {
				log.Warn().Err(err).Msg("网易云账号自动续期失败")
			}
		}
	}
}
