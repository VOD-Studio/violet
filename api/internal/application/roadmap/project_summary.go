package roadmap

import (
	"context"
	"time"

	appproject "blog-api/internal/application/project"
	domain "blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

type ProjectSummaryReader struct {
	reader domain.SummaryReader
}

func NewProjectSummaryReader(reader domain.SummaryReader) *ProjectSummaryReader {
	return &ProjectSummaryReader{reader: reader}
}

func (r *ProjectSummaryReader) ReadSummaries(ctx context.Context, projectIDs []shared.ID) (map[shared.ID]appproject.RoadmapSummaryDTO, error) {
	summaries, err := r.reader.ReadSummaries(ctx, projectIDs)
	if err != nil {
		return nil, err
	}
	result := make(map[shared.ID]appproject.RoadmapSummaryDTO, len(projectIDs))
	for _, id := range projectIDs {
		summary := summaries[id]
		progress := appproject.RoadmapProgressDTO{Planned: summary.Counts.Planned, InProgress: summary.Counts.InProgress,
			Completed: summary.Counts.Completed, Total: summary.Counts.Total}
		if progress.Total > 0 {
			progress.Percent = (progress.Completed*100 + progress.Total/2) / progress.Total
		}
		dto := appproject.RoadmapSummaryDTO{Progress: progress,
			InProgress: make([]appproject.RoadmapItemPreviewDTO, 0, len(summary.InProgress))}
		for _, item := range summary.InProgress {
			dto.InProgress = append(dto.InProgress, previewDTO(item))
		}
		if summary.LatestCompleted != nil {
			latest := previewDTO(*summary.LatestCompleted)
			dto.LatestCompleted = &latest
		}
		result[id] = dto
	}
	return result, nil
}

func previewDTO(item domain.ItemPreview) appproject.RoadmapItemPreviewDTO {
	dto := appproject.RoadmapItemPreviewDTO{ID: item.ID.String(), Number: item.Number, Title: item.Title}
	if item.CompletionDate != nil {
		date := item.CompletionDate.Format(time.DateOnly)
		dto.CompletionDate = &date
	}
	return dto
}

var _ appproject.RoadmapSummaryReader = (*ProjectSummaryReader)(nil)
