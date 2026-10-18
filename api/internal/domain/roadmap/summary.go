package roadmap

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

type ProgressCounts struct {
	// Planned 未删除的规划中条目数。
	Planned int
	// InProgress 未删除的开发中条目数。
	InProgress int
	// Completed 未删除的已完成条目数。
	Completed int
	// Total 未删除的全部条目数。
	Total int
}

type ItemPreview struct {
	// ID 条目稳定标识，供使用方打开详情。
	ID shared.ID
	// Number 项目内稳定编号。
	Number int64
	// Title 纯文本标题，不读取完整条目内容。
	Title string
	// CompletionDate 已完成条目的日历日期；开发中条目为 nil。
	CompletionDate *time.Time
}

type ProjectSummary struct {
	// Counts 只统计未删除条目，所有阶段使用同一读取快照。
	Counts ProgressCounts
	// InProgress 按位置及编号升序选取至多两条；空时为空切片。
	InProgress []ItemPreview
	// LatestCompleted 按完成日期及编号倒序选取一条；无已完成条目时为 nil。
	LatestCompleted *ItemPreview
}

type SummaryReader interface {
	// ReadSummaries 为每个请求的项目返回摘要，无未删除条目时返回零计数。
	ReadSummaries(ctx context.Context, projectIDs []shared.ID) (map[shared.ID]ProjectSummary, error)
}
