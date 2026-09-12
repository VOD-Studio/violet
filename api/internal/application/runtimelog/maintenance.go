package runtimelog

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
	"github.com/rs/zerolog/log"
)

const (
	MinRetentionDays int64 = 1
	MaxRetentionDays int64 = 3650
	MinRetainedLogs  int64 = 100
	MaxRetainedLogs  int64 = 10_000_000
	MinRetainedBytes int64 = 1 << 20
	MaxRetainedBytes int64 = 100 << 30

	rotationBatchSize  = 10_000
	maxRotationBatches = 20
)

var ErrRotationRunning = shared.Conflict("运行日志轮转正在执行")

type PolicyLimits struct {
	RetentionDaysMin int64 `json:"retention_days_min"`
	RetentionDaysMax int64 `json:"retention_days_max"`
	MaxRecordsMin    int64 `json:"max_records_min"`
	MaxRecordsMax    int64 `json:"max_records_max"`
	MaxBytesMin      int64 `json:"max_bytes_min"`
	MaxBytesMax      int64 `json:"max_bytes_max"`
}

type RotationStatus struct {
	Running           bool       `json:"running"`
	NextRunAt         time.Time  `json:"next_run_at"`
	LastStartedAt     *time.Time `json:"last_started_at"`
	LastFinishedAt    *time.Time `json:"last_finished_at"`
	LastDeleted       int64      `json:"last_deleted"`
	LastError         string     `json:"last_error,omitempty"`
	LastPolicyVersion int64      `json:"last_policy_version"`
	// ActivePolicyVersion nil 表示当前没有执行轮转或仍在读取策略。
	ActivePolicyVersion *int64 `json:"active_policy_version,omitempty"`
	RemainingOverLimit  bool   `json:"remaining_over_limit"`
}

type MaintenanceSnapshot struct {
	Policy   domainlog.Policy `json:"policy"`
	Usage    domainlog.Usage  `json:"usage"`
	Limits   PolicyLimits     `json:"limits"`
	Rotation RotationStatus   `json:"rotation"`
}

type RotationResult struct {
	Deleted            int64 `json:"deleted"`
	RemainingOverLimit bool  `json:"remaining_over_limit"`
}

type MaintenanceService struct {
	store    domainlog.MaintenanceStore
	interval time.Duration
	trigger  chan struct{}
	running  atomic.Bool
	mu       sync.RWMutex
	status   RotationStatus
}

func NewMaintenanceService(store domainlog.MaintenanceStore, interval time.Duration) *MaintenanceService {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &MaintenanceService{
		store:    store,
		interval: interval,
		trigger:  make(chan struct{}, 1),
		status:   RotationStatus{NextRunAt: time.Now().UTC()},
	}
}

func (s *MaintenanceService) Snapshot(ctx context.Context) (MaintenanceSnapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	policy, err := s.store.GetPolicy(ctx)
	if err != nil {
		return MaintenanceSnapshot{}, shared.Internal("运行日志保留策略读取失败", err)
	}
	usage, err := s.store.Usage(ctx)
	if err != nil {
		return MaintenanceSnapshot{}, shared.Internal("运行日志容量读取失败", err)
	}
	return MaintenanceSnapshot{Policy: policy, Usage: usage, Limits: policyLimits(), Rotation: s.Status()}, nil
}

func (s *MaintenanceService) UpdatePolicy(ctx context.Context, expected int64, retentionDays int, maxRecords, maxBytes int64) (domainlog.Policy, error) {
	if expected < 0 {
		return domainlog.Policy{}, shared.BadRequest("expected_version 必须是非负整数")
	}
	if int64(retentionDays) < MinRetentionDays || int64(retentionDays) > MaxRetentionDays {
		return domainlog.Policy{}, shared.BadRequest("运行日志保留天数超出允许范围")
	}
	if maxRecords < MinRetainedLogs || maxRecords > MaxRetainedLogs {
		return domainlog.Policy{}, shared.BadRequest("运行日志最大记录数超出允许范围")
	}
	if maxBytes < MinRetainedBytes || maxBytes > MaxRetainedBytes {
		return domainlog.Policy{}, shared.BadRequest("运行日志容量上限超出允许范围")
	}
	saved, err := s.store.UpdatePolicy(ctx, expected, domainlog.Policy{
		RetentionDays: retentionDays,
		MaxRecords:    maxRecords,
		MaxBytes:      maxBytes,
	})
	if err != nil {
		return domainlog.Policy{}, err
	}
	s.Trigger()
	return saved, nil
}

func (s *MaintenanceService) Trigger() {
	s.setNextRun(time.Now().UTC())
	select {
	case s.trigger <- struct{}{}:
	default:
	}
}

func (s *MaintenanceService) Run(ctx context.Context) {
	timer := time.NewTimer(0)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.trigger:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(0)
		case <-timer.C:
			runCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
			result, err := s.RotateNow(runCtx)
			cancel()
			delay := s.interval
			if errors.Is(err, ErrRotationRunning) || err == nil && result.RemainingOverLimit {
				delay = time.Second
			} else if err != nil && ctx.Err() == nil {
				log.Error().Err(err).Str("source", "runtimelog-maintenance").Msg("运行日志轮转失败")
			}
			next := time.Now().UTC().Add(delay)
			s.setNextRun(next)
			timer.Reset(time.Until(next))
		}
	}
}

func (s *MaintenanceService) RotateNow(ctx context.Context) (RotationResult, error) {
	if !s.running.CompareAndSwap(false, true) {
		return RotationResult{}, ErrRotationRunning
	}
	defer s.running.Store(false)
	started := time.Now().UTC()
	s.mu.Lock()
	s.status.LastStartedAt = &started
	s.status.LastError = ""
	s.status.ActivePolicyVersion = nil
	s.mu.Unlock()

	policy, err := s.store.GetPolicy(ctx)
	if err != nil {
		s.failRotation("保留策略读取失败")
		return RotationResult{}, shared.Internal("运行日志保留策略读取失败", err)
	}
	version := policy.Version
	s.mu.Lock()
	s.status.ActivePolicyVersion = &version
	s.mu.Unlock()
	cutoff := started.AddDate(0, 0, -policy.RetentionDays)
	var deleted int64
	for range maxRotationBatches {
		count, err := s.store.RotateBatch(ctx, policy, cutoff, rotationBatchSize)
		if err != nil {
			s.failRotation("轮转删除失败")
			return RotationResult{}, shared.Internal("运行日志轮转失败", err)
		}
		deleted += count
		if count == 0 {
			break
		}
	}
	usage, err := s.store.Usage(ctx)
	if err != nil {
		s.failRotation("轮转结果读取失败")
		return RotationResult{}, shared.Internal("运行日志轮转结果读取失败", err)
	}
	remaining := exceedsPolicy(usage, policy, cutoff)
	finished := time.Now().UTC()
	s.mu.Lock()
	s.status.LastFinishedAt = &finished
	s.status.LastDeleted = deleted
	s.status.LastError = ""
	s.status.LastPolicyVersion = policy.Version
	s.status.ActivePolicyVersion = nil
	s.status.RemainingOverLimit = remaining
	s.mu.Unlock()
	return RotationResult{Deleted: deleted, RemainingOverLimit: remaining}, nil
}

func (s *MaintenanceService) Status() RotationStatus {
	s.mu.RLock()
	status := s.status
	s.mu.RUnlock()
	status.Running = s.running.Load()
	return status
}

func (s *MaintenanceService) failRotation(message string) {
	finished := time.Now().UTC()
	s.mu.Lock()
	s.status.LastFinishedAt = &finished
	s.status.LastError = message
	s.status.ActivePolicyVersion = nil
	s.mu.Unlock()
}

func (s *MaintenanceService) setNextRun(next time.Time) {
	s.mu.Lock()
	s.status.NextRunAt = next
	s.mu.Unlock()
}

func policyLimits() PolicyLimits {
	return PolicyLimits{
		RetentionDaysMin: MinRetentionDays,
		RetentionDaysMax: MaxRetentionDays,
		MaxRecordsMin:    MinRetainedLogs,
		MaxRecordsMax:    MaxRetainedLogs,
		MaxBytesMin:      MinRetainedBytes,
		MaxBytesMax:      MaxRetainedBytes,
	}
}

func exceedsPolicy(usage domainlog.Usage, policy domainlog.Policy, cutoff time.Time) bool {
	return usage.Records > policy.MaxRecords ||
		usage.PayloadBytes > policy.MaxBytes ||
		usage.OldestReceivedAt != nil && usage.OldestReceivedAt.Before(cutoff)
}
