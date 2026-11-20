package repositoryactivity

import (
	"context"
	"fmt"
	"slices"
	"time"

	activity "blog-api/internal/domain/repositoryactivity"
)

// Growth 为关于页提供运行天数及同一快照上的仓库活动。
type Growth struct {
	activity.GrowthHistory
	Today       string          `json:"today"`        // 上海日历日期，YYYY-MM-DD。
	ElapsedDays *int            `json:"elapsed_days"` // 首次提交到今天相隔的日历日数；未知时为 nil。
	Health      activity.Health `json:"health"`
}

// Growth 仅读取与站点发布仓库且与公开项目匹配的同步快照。
func (s *Service) Growth(ctx context.Context, key string) (Growth, error) {
	now := s.now()
	today := calendarDay(now)
	result := Growth{
		GrowthHistory: activity.GrowthHistory{Weeks: []activity.GrowthWeek{}, Releases: []activity.Release{}},
		Today:         today.Format(time.DateOnly), Health: activity.Health{State: activity.StateUnconfigured},
	}
	if key == "" {
		return result, nil
	}
	bindings, err := s.bindings(ctx, nil)
	if err != nil {
		return Growth{}, fmt.Errorf("读取公开项目的仓库绑定: %w", err)
	}
	bindings = slices.DeleteFunc(bindings, func(binding activity.Binding) bool { return binding.Key != key })
	if len(bindings) == 0 {
		return result, nil
	}
	health, err := s.health(ctx, []string{key}, now)
	if err != nil {
		return Growth{}, fmt.Errorf("读取花园仓库的同步状态: %w", err)
	}
	history, err := s.storage.Growth(ctx, bindings, result.Today, now.Add(-keepFor))
	if err != nil {
		return Growth{}, fmt.Errorf("读取花园仓库的历史: %w", err)
	}
	result.Health, result.GrowthHistory = health, history
	if history.FirstCommit != nil {
		days := int((today.Unix() - calendarDay(history.FirstCommit.OccurredAt).Unix()) / 86_400)
		result.ElapsedDays = &days
	}
	return result, nil
}

func calendarDay(instant time.Time) time.Time {
	year, month, day := instant.In(activity.Location).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}
