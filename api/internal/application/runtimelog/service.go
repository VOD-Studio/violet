package runtimelog

import (
	"context"
	"strconv"
	"strings"
	"time"

	domainlog "blog-api/internal/domain/runtimelog"
	"blog-api/internal/domain/shared"
)

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

type Service struct{ store domainlog.Store }

func NewService(store domainlog.Store) *Service { return &Service{store: store} }

func (s *Service) List(ctx context.Context, filter domainlog.Filter) (Page, error) {
	if filter.Limit == 0 {
		filter.Limit = 100
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		return Page{}, shared.BadRequest("每次读取数量必须在 1 到 200 之间")
	}
	if filter.Before < 0 || filter.After < 0 || (filter.Before > 0 && filter.After > 0) {
		return Page{}, shared.BadRequest("不能同时指定向前和向后的续读游标")
	}
	if len(filter.Keyword) > 256 || len(filter.Source) > 128 || len(filter.RequestID) > 128 || len(filter.TraceID) > 128 || len(filter.Levels) > 7 {
		return Page{}, shared.BadRequest("日志筛选条件过长")
	}
	if !filter.From.IsZero() && !filter.Until.IsZero() && !filter.From.Before(filter.Until) {
		return Page{}, shared.BadRequest("开始时间必须早于结束时间")
	}
	for i, level := range filter.Levels {
		level = strings.ToLower(strings.TrimSpace(level))
		switch level {
		case "trace", "debug", "info", "warn", "error", "fatal", "panic":
		default:
			return Page{}, shared.BadRequest("未知日志级别")
		}
		filter.Levels[i] = level
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	bounds, err := s.store.Bounds(ctx)
	if err != nil {
		return Page{}, shared.Internal("运行日志读取暂不可用", err)
	}
	if bounds.Newest == 0 {
		return Page{Items: []domainlog.Entry{}}, nil
	}
	filter.Through = bounds.Newest
	limit := filter.Limit
	filter.Limit++
	entries, err := s.store.Read(ctx, filter)
	if err != nil {
		return Page{}, shared.Internal("运行日志读取失败或超过查询时间限制", err)
	}
	page := Page{Items: entries, OldestCursor: cursor(bounds.Oldest), NewestCursor: cursor(bounds.Newest), HasMore: len(entries) > limit, Gap: filter.After > 0 && bounds.Oldest > filter.After+1}
	if page.HasMore {
		page.Items = entries[:limit]
		page.NextCursor = cursor(page.Items[len(page.Items)-1].ID)
	}
	return page, nil
}

func cursor(id int64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatInt(id, 10)
}
