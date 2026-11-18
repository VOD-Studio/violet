package job

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	appactivity "blog-api/internal/application/repositoryactivity"
)

// RunRepositoryActivity 在启动时回填一批，此后定期继续同步；取消应用上下文即停止。
func RunRepositoryActivity(ctx context.Context, service *appactivity.Service) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()
	for ctx.Err() == nil {
		workCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
		err := service.Sync(workCtx)
		cancel()
		if err != nil && ctx.Err() == nil {
			log.Warn().Err(err).Msg("仓库进展同步未完成")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
