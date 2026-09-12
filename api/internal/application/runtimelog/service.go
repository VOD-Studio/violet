package runtimelog

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
)

var errStopExport = errors.New("stop runtime log export")

type Page struct {
	Items        []domainlog.Entry `json:"items"`
	NextCursor   string            `json:"next_cursor"`
	OldestCursor string            `json:"oldest_cursor"`
	NewestCursor string            `json:"newest_cursor"`
	HasMore      bool              `json:"has_more"`
	// Gap 请求的续读边界已早于仍可读取的日志；不能声称完整续接。
	Gap bool `json:"gap"`
}

type CollectionStatus struct {
	Enabled              bool       `json:"enabled"`
	InitializationFailed bool       `json:"initialization_failed"`
	Accepted             uint64     `json:"accepted"`
	Persisted            uint64     `json:"persisted"`
	QueueOverflow        uint64     `json:"queue_overflow"`
	PersistenceFailed    uint64     `json:"persistence_failed"`
	Malformed            uint64     `json:"malformed"`
	Oversized            uint64     `json:"oversized"`
	ShutdownDropped      uint64     `json:"shutdown_dropped"`
	Queued               int        `json:"queued"`
	Capacity             int        `json:"capacity"`
	LastFailure          *time.Time `json:"last_failure"`
}

type StatusProvider interface{ Stats() CollectionStatus }

type ExportPlan struct {
	filter        domainlog.Filter
	maxRecords    int
	throughCursor string
	empty         bool
}

type ExportResult struct {
	Exported           int
	LastCursor         string
	ThroughCursor      string
	RecordLimitReached bool
	SinkStopped        bool
}

type Service struct{ store domainlog.Store }

func NewService(store domainlog.Store) *Service { return &Service{store: store} }

func (s *Service) List(ctx context.Context, filter domainlog.Filter) (Page, error) {
	if filter.Limit == 0 {
		filter.Limit = 100
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		return Page{}, shared.BadRequest("每次读取数量必须在 1 到 200 之间")
	}
	filter, err := normalizeFilter(filter)
	if err != nil {
		return Page{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	limit := filter.Limit
	filter.Limit++
	bounds, entries, err := s.store.ReadPage(ctx, filter)
	if err != nil {
		return Page{}, shared.Internal("运行日志读取失败或超过查询时间限制", err)
	}
	page := Page{
		Items:        entries,
		OldestCursor: cursor(bounds.Oldest),
		NewestCursor: cursor(bounds.Newest),
		HasMore:      len(entries) > limit,
		Gap:          hasCursorGap(filter.After, filter.AfterSet, bounds),
	}
	if page.HasMore {
		page.Items = entries[:limit]
		page.NextCursor = cursor(page.Items[len(page.Items)-1].ID)
	}
	return page, nil
}

func hasCursorGap(after int64, afterSet bool, bounds domainlog.Bounds) bool {
	if !afterSet {
		return false
	}
	return after > bounds.Newest ||
		bounds.Oldest == 0 && after < bounds.Newest ||
		bounds.Oldest > 0 && after < bounds.Oldest-1
}

func (s *Service) CurrentBounds(ctx context.Context) (domainlog.Bounds, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	bounds, err := s.store.Bounds(ctx)
	if err != nil {
		return domainlog.Bounds{}, shared.Internal("运行日志续读边界暂不可用", err)
	}
	return bounds, nil
}

func (s *Service) PrepareExport(ctx context.Context, filter domainlog.Filter, maxRecords int) (ExportPlan, error) {
	filter.Before = 0
	filter.After = 0
	filter.AfterSet = false
	filter.Through = 0
	filter.Ascending = true
	filter.Limit = maxRecords + 1
	filter, err := normalizeFilter(filter)
	if err != nil {
		return ExportPlan{}, err
	}
	bounds, err := s.CurrentBounds(ctx)
	if err != nil {
		return ExportPlan{}, err
	}
	filter.Through = bounds.Newest
	return ExportPlan{
		filter:        filter,
		maxRecords:    maxRecords,
		throughCursor: cursor(bounds.Newest),
		empty:         bounds.Newest == 0,
	}, nil
}

func (s *Service) WalkExport(ctx context.Context, plan ExportPlan, visit func(domainlog.Entry) (bool, error)) (ExportResult, error) {
	result := ExportResult{ThroughCursor: plan.throughCursor}
	if plan.empty {
		return result, nil
	}
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()
	err := s.store.Walk(ctx, plan.filter, func(entry domainlog.Entry) error {
		if result.Exported >= plan.maxRecords {
			result.RecordLimitReached = true
			return errStopExport
		}
		keepGoing, err := visit(entry)
		if err != nil {
			return err
		}
		if !keepGoing {
			result.SinkStopped = true
			return errStopExport
		}
		result.Exported++
		result.LastCursor = cursor(entry.ID)
		return nil
	})
	if errors.Is(err, errStopExport) {
		err = nil
	}
	return result, err
}

func normalizeFilter(filter domainlog.Filter) (domainlog.Filter, error) {
	if filter.Before < 0 || filter.After < 0 || (filter.Before > 0 && filter.After > 0) {
		return filter, shared.BadRequest("不能同时指定向前和向后的续读游标")
	}
	if len(filter.Keyword) > 256 || len(filter.Source) > 128 || len(filter.RequestID) > 128 || len(filter.TraceID) > 128 || len(filter.Levels) > 7 {
		return filter, shared.BadRequest("日志筛选条件过长")
	}
	if !filter.From.IsZero() && !filter.Until.IsZero() && !filter.From.Before(filter.Until) {
		return filter, shared.BadRequest("开始时间必须早于结束时间")
	}
	for i, level := range filter.Levels {
		level = strings.ToLower(strings.TrimSpace(level))
		switch level {
		case "trace", "debug", "info", "warn", "error", "fatal", "panic":
		default:
			return filter, shared.BadRequest("未知日志级别")
		}
		filter.Levels[i] = level
	}
	return filter, nil
}

func cursor(id int64) string {
	return strconv.FormatInt(id, 10)
}
