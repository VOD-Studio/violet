package project

import (
	"context"

	"blog-api/internal/domain/shared"
)

type RoadmapProgressDTO struct {
	Planned    int `json:"planned"`
	InProgress int `json:"in_progress"`
	Completed  int `json:"completed"`
	Total      int `json:"total"`
	// Percent 已完成除以未删除条目总数，四舍五入为整数百分比；无条目为 0。
	Percent int `json:"percent"`
}

type RoadmapItemPreviewDTO struct {
	ID     string `json:"id"`
	Number int64  `json:"number"`
	Title  string `json:"title"`
	// CompletionDate 已完成条目为 YYYY-MM-DD；开发中条目为 nil。
	CompletionDate *string `json:"completion_date"`
}

type RoadmapSummaryDTO struct {
	Progress RoadmapProgressDTO `json:"progress"`
	// InProgress 至多两条，按管理员的手动顺序选取。
	InProgress []RoadmapItemPreviewDTO `json:"in_progress"`
	// LatestCompleted 无已完成条目时为 nil。
	LatestCompleted *RoadmapItemPreviewDTO `json:"latest_completed"`
}

type RoadmapSummaryReader interface {
	ReadSummaries(ctx context.Context, projectIDs []shared.ID) (map[shared.ID]RoadmapSummaryDTO, error)
}
