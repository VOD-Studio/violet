package system

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

// sampleInterval 采样间隔（30s）
const sampleInterval = 30 * time.Second

// Sampler 定时采样 goroutine
type Sampler struct {
	collector MetricCollector
	rdb       redisStore
	svc       *Service
	ctx       context.Context
}

// redisStore Redis 操作所需的最小接口（便于测试 mock）
type redisStore interface {
	StoreSample(ctx context.Context, p SamplePoint) error
}

// NewSampler 构造采样器
func NewSampler(ctx context.Context, collector MetricCollector, svc *Service) *Sampler {
	return &Sampler{ctx: ctx, collector: collector, svc: svc, rdb: svc}
}

// Run 启动定时采样循环，随 ctx 取消退出
func (s *Sampler) Run() {
	// 启动后立即采集一次，避免首屏历史为空
	s.sampleOnce()

	ticker := time.NewTicker(sampleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			log.Info().Msg("系统监控采样器已停止")
			return
		case <-ticker.C:
			s.sampleOnce()
		}
	}
}

// sampleOnce 采集一次并存入 Redis，失败仅记日志不阻断
func (s *Sampler) sampleOnce() {
	snap, err := s.collector.Collect()
	if err != nil {
		log.Error().Err(err).Msg("监控采样失败")
		return
	}
	// 依赖探活（历史点中含延迟）
	s.svc.checkDependencies(s.ctx, snap)
	point := ToSamplePoint(snap)
	if err := s.rdb.StoreSample(s.ctx, point); err != nil {
		log.Warn().Err(err).Msg("监控采样写入 Redis 失败")
	}
}
