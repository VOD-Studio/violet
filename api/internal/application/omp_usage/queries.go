package ompusage

import (
	"context"
	"time"

	domain "blog-api/internal/domain/omp_usage"
	"blog-api/internal/domain/shared"
)

type ModelsDTO struct {
	Models []domain.ModelUsage `json:"models"`
}

type TimeseriesDTO struct {
	Bucket string         `json:"bucket"`
	Points []domain.Point `json:"points"`
}

func (s *Service) window(userID, selected string) (time.Time, time.Time, error) {
	if userID == "" {
		return time.Time{}, time.Time{}, shared.Unauthorized("请先登录")
	}
	days := 30
	switch selected {
	case "", "30d":
	case "7d":
		days = 7
	case "90d":
		days = 90
	default:
		return time.Time{}, time.Time{}, shared.BadRequest("range 须为 7d、30d 或 90d")
	}
	now := s.now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(days - 1))
	return start, now, nil
}

func (s *Service) Summary(ctx context.Context, userID, selected string) (domain.Summary, error) {
	start, end, err := s.window(userID, selected)
	if err != nil {
		return domain.Summary{}, err
	}
	return s.repo.Summary(ctx, userID, start, end)
}

func (s *Service) Models(ctx context.Context, userID, selected string) (ModelsDTO, error) {
	start, end, err := s.window(userID, selected)
	if err != nil {
		return ModelsDTO{}, err
	}
	models, err := s.repo.Models(ctx, userID, start, end)
	if models == nil {
		models = []domain.ModelUsage{}
	}
	return ModelsDTO{Models: models}, err
}

func (s *Service) Timeseries(ctx context.Context, userID, selected, bucket string) (TimeseriesDTO, error) {
	start, end, err := s.window(userID, selected)
	if err != nil {
		return TimeseriesDTO{}, err
	}
	if bucket == "" {
		bucket = "day"
	}
	if bucket != "day" && bucket != "hour" {
		return TimeseriesDTO{}, shared.BadRequest("bucket 须为 day 或 hour")
	}
	points, err := s.repo.Timeseries(ctx, userID, start, end, bucket)
	return TimeseriesDTO{Bucket: bucket, Points: points}, err
}
