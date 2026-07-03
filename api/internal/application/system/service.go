// Package system 提供服务器监控的应用用例。
package system

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
)

// snapshotKey Redis 存储历史采样点的 key
const snapshotKey = "monitor:snapshots"

// maxHistoryPoints 保留的最大历史点数（24h / 30s = 2880）
const maxHistoryPoints = 2880

// MetricCollector 指标采集接口（由 infrastructure 实现）
type MetricCollector interface {
	Collect() (*Snapshot, error)
}

// Service 服务器监控用例服务
type Service struct {
	collector MetricCollector
	rdb       *redis.Client
	db        *gorm.DB
}

// NewService 构造监控服务
func NewService(db *gorm.DB, rdb *redis.Client, collector MetricCollector) *Service {
	return &Service{db: db, rdb: rdb, collector: collector}
}

// GetSnapshot 实时采集一次完整快照（含依赖探活）
func (s *Service) GetSnapshot(ctx context.Context) (*Snapshot, error) {
	snap, err := s.collector.Collect()
	if err != nil {
		return nil, domainshared.NewError(string(domainshared.CodeInternal), "采集系统指标失败").WithErr(err)
	}
	s.checkDependencies(ctx, snap)
	return snap, nil
}

// checkDependencies 探活 PostgreSQL 与 Redis，填充依赖状态
func (s *Service) checkDependencies(ctx context.Context, snap *Snapshot) {
	snap.Dependencies.Postgres = s.checkPostgres(ctx)
	snap.Dependencies.Redis = s.checkRedis(ctx)
}

func (s *Service) checkPostgres(ctx context.Context) DependencyCheck {
	if s.db == nil {
		return DependencyCheck{Connected: false, Error: "postgres not configured"}
	}
	start := time.Now()
	sqlDB, err := s.db.DB()
	if err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	stats := sqlDB.Stats()
	return DependencyCheck{
		Connected: true,
		LatencyMs: time.Since(start).Milliseconds(),
		Pool: PoolStats{
			InUse:     stats.InUse,
			Idle:      stats.Idle,
			MaxOpen:   stats.MaxOpenConnections,
			WaitCount: stats.WaitCount,
		},
	}
}

func (s *Service) checkRedis(ctx context.Context) DependencyCheck {
	if s.rdb == nil {
		return DependencyCheck{Connected: false, Error: "redis not configured"}
	}
	start := time.Now()
	if err := s.rdb.Ping(ctx).Err(); err != nil {
		return DependencyCheck{Connected: false, Error: err.Error()}
	}
	ps := s.rdb.PoolStats()
	return DependencyCheck{
		Connected: true,
		LatencyMs: time.Since(start).Milliseconds(),
		Pool: PoolStats{
			InUse:     int(ps.TotalConns - ps.IdleConns),
			Idle:      int(ps.IdleConns),
			MaxOpen:   int(ps.TotalConns),
			WaitCount: int64(ps.WaitCount),
		},
	}
}

// GetHistory 从 Redis 读取历史采样点（按时间升序）
func (s *Service) GetHistory(ctx context.Context) (*HistoryResponse, error) {
	if s.rdb == nil {
		return &HistoryResponse{Interval: 30, Points: []SamplePoint{}}, nil
	}
	raw, err := s.rdb.LRange(ctx, snapshotKey, 0, -1).Result()
	if err != nil {
		// Redis 不可用时返回空数组，不报错（实时快照仍可用）
		return &HistoryResponse{Interval: 30, Points: []SamplePoint{}}, nil
	}
	// LPUSH 最新在前，反转成升序
	points := make([]SamplePoint, 0, len(raw))
	for i := len(raw) - 1; i >= 0; i-- {
		var p SamplePoint
		if err := json.Unmarshal([]byte(raw[i]), &p); err == nil {
			points = append(points, p)
		}
	}
	return &HistoryResponse{Interval: 30, Points: points}, nil
}

// StoreSample 存储一个采样点到 Redis（供 sampler 调用）
func (s *Service) StoreSample(ctx context.Context, p SamplePoint) error {
	if s.rdb == nil {
		return errors.New("redis unavailable")
	}
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	pipe := s.rdb.TxPipeline()
	pipe.LPush(ctx, snapshotKey, data)
	pipe.LTrim(ctx, snapshotKey, 0, int64(maxHistoryPoints-1))
	pipe.Expire(ctx, snapshotKey, 25*time.Hour)
	_, err = pipe.Exec(ctx)
	return err
}

// ToSamplePoint 将完整快照转为精简历史采样点
func ToSamplePoint(snap *Snapshot) SamplePoint {
	p := SamplePoint{Timestamp: snap.Timestamp}
	p.CPU.UsagePercent = snap.CPU.UsagePercent
	p.CPU.PerCore = snap.CPU.PerCore
	p.Mem.UsedPercent = snap.Memory.UsedPercent
	p.Mem.UsedBytes = snap.Memory.UsedBytes
	p.Mem.SwapPercent = snap.Memory.SwapPercent
	p.Mem.GoAlloc = snap.Runtime.MemStats.AllocBytes
	p.Net.Sent = snap.Network.IO.BytesSent
	p.Net.Recv = snap.Network.IO.BytesRecv
	p.Net.SendRt = snap.Network.IO.SendRateBytes
	p.Net.RecvRt = snap.Network.IO.RecvRateBytes
	p.Load.L1 = snap.Load.Load1
	p.Load.L5 = snap.Load.Load5
	p.Load.L15 = snap.Load.Load15
	p.Rt.Gr = snap.Runtime.Goroutines
	p.Rt.NumGC = snap.Runtime.GC.NumGC
	p.Rt.HeapObj = snap.Runtime.MemStats.HeapObjects
	p.Rt.Threads = snap.Runtime.NumThreads
	p.Rt.NumCgo = snap.Runtime.NumCgoCall
	p.Deps.PgMs = snap.Dependencies.Postgres.LatencyMs
	p.Deps.RdsMs = snap.Dependencies.Redis.LatencyMs
	for _, d := range snap.Disk {
		p.Disk = append(p.Disk, struct {
			Path        string  `json:"p"`
			UsedPercent float64 `json:"up"`
			ReadBytes   uint64  `json:"rb"`
			WriteBytes  uint64  `json:"wb"`
		}{Path: d.Path, UsedPercent: d.UsedPercent, ReadBytes: d.ReadBytes, WriteBytes: d.WriteBytes})
	}
	return p
}
