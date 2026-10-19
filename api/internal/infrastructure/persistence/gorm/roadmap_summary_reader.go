package gorm

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

type RoadmapSummaryReader struct{ db *gorm.DB }

func NewRoadmapSummaryReader(db *gorm.DB) *RoadmapSummaryReader {
	return &RoadmapSummaryReader{db: db}
}

func (r *RoadmapSummaryReader) ReadSummaries(ctx context.Context, projectIDs []shared.ID) (map[shared.ID]domain.ProjectSummary, error) {
	result := make(map[shared.ID]domain.ProjectSummary, len(projectIDs))
	if len(projectIDs) == 0 {
		return result, nil
	}
	ids := make([]uuid.UUID, 0, len(projectIDs))
	for _, id := range projectIDs {
		ids = append(ids, id.UUID())
		result[id] = domain.ProjectSummary{InProgress: []domain.ItemPreview{}}
	}
	type row struct {
		ProjectID      uuid.UUID
		Planned        int
		InProgress     int
		Completed      int
		Total          int
		ItemID         *uuid.UUID
		Number         int64
		Title          string
		Stage          string
		CompletionDate *time.Time
	}
	var rows []row
	// 一条语句保证计数与预览共享读取快照；不加载简介、标签或链接。
	if err := r.db.WithContext(ctx).Raw(`
		WITH active AS (
			SELECT id, project_id, number, title, stage, position, completion_date
			FROM roadmap_items WHERE project_id IN ? AND deleted_at IS NULL
		), counts AS (
			SELECT project_id,
				COUNT(*) FILTER (WHERE stage = 'planned') AS planned,
				COUNT(*) FILTER (WHERE stage = 'in_progress') AS in_progress,
				COUNT(*) FILTER (WHERE stage = 'completed') AS completed,
				COUNT(*) AS total
			FROM active GROUP BY project_id
		), ranked AS (
			SELECT id, project_id, number, title, stage, completion_date,
				ROW_NUMBER() OVER (PARTITION BY project_id, stage ORDER BY
					CASE WHEN stage = 'in_progress' THEN position END ASC,
					CASE WHEN stage = 'completed' THEN completion_date END DESC,
					CASE WHEN stage = 'completed' THEN number END DESC,
					number ASC) AS preview_order
			FROM active WHERE stage IN ('in_progress', 'completed')
		)
		SELECT counts.project_id, counts.planned, counts.in_progress, counts.completed, counts.total,
			ranked.id AS item_id, ranked.number, ranked.title, ranked.stage, ranked.completion_date
		FROM counts LEFT JOIN ranked ON ranked.project_id = counts.project_id
			AND ((ranked.stage = 'in_progress' AND ranked.preview_order <= 2)
				OR (ranked.stage = 'completed' AND ranked.preview_order = 1))
		ORDER BY counts.project_id, ranked.stage, ranked.preview_order`, ids).Scan(&rows).Error; err != nil {
		return nil, shared.Internal("查询项目路线图摘要失败", err)
	}
	for _, row := range rows {
		id := shared.IDFromUUID(row.ProjectID)
		summary := result[id]
		summary.Counts = domain.ProgressCounts{Planned: row.Planned, InProgress: row.InProgress,
			Completed: row.Completed, Total: row.Total}
		if row.ItemID != nil {
			preview := domain.ItemPreview{ID: shared.IDFromUUID(*row.ItemID), Number: row.Number,
				Title: row.Title, CompletionDate: row.CompletionDate}
			switch domain.Stage(row.Stage) {
			case domain.InProgress:
				summary.InProgress = append(summary.InProgress, preview)
			case domain.Completed:
				summary.LatestCompleted = &preview
			}
		}
		result[id] = summary
	}
	return result, nil
}

var _ domain.SummaryReader = (*RoadmapSummaryReader)(nil)
