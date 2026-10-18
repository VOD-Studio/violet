package roadmap

import (
	"time"

	appproject "blog-api/internal/application/project"
	domain "blog-api/internal/domain/roadmap"
)

type LinkDTO struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// ChecklistItemDTO 条目的一个子项；只展示推进细节，不改变阶段，也不计入项目进度。
type ChecklistItemDTO struct {
	Text string `json:"text"`
	Done bool   `json:"done"`
}

type ItemDTO struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	Number      int64     `json:"number"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Stage       string    `json:"stage"`
	Position    string    `json:"position"`
	Tags        []string  `json:"tags"`
	Links       []LinkDTO `json:"links"`
	// Checklist 有序子项，没有时是空数组而不是 null。
	Checklist []ChecklistItemDTO `json:"checklist"`
	// CompletionDate nil 表示未完成，非空为 YYYY-MM-DD，不携带时区或时间。
	CompletionDate   *string `json:"completion_date"`
	DeliveredVersion string  `json:"delivered_version"`
	// Blocked 由未完成的阻塞前置条目派生，不改变阶段。
	Blocked   bool   `json:"blocked"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type ProgressDTO struct {
	Planned    int `json:"planned"`
	InProgress int `json:"in_progress"`
	Completed  int `json:"completed"`
	Total      int `json:"total"`
	// Percent 已完成除以未删除条目总数，四舍五入到 0–100 的整数；空路线图为 0。
	Percent int `json:"percent"`
}

type DetailDTO struct {
	Project   appproject.ProjectDTO `json:"project"`
	Items     []ItemDTO             `json:"items"`
	Relations []RelationDTO         `json:"relations"`
	Progress  ProgressDTO           `json:"progress"`
}

type CreateInput struct {
	Title       string
	Description string
	// Stage 空串时创建到 planned。
	Stage string
	Tags  []string
	Links []LinkDTO
	// Checklist 有序子项，省略为没有子项。
	Checklist []ChecklistItemDTO
	// CompletionDate YYYY-MM-DD；创建到 completed 时 nil 默认上海时区当天。
	CompletionDate   *string
	DeliveredVersion string
}

type UpdateInput struct {
	Title       string
	Description string
	Tags        []string
	Links       []LinkDTO
	// Checklist 全量替换；省略或空数组清空子项。
	Checklist []ChecklistItemDTO
	// CompletionDate YYYY-MM-DD；nil 保留旧日期，非空替换。阶段只通过移动改变。
	CompletionDate   *string
	DeliveredVersion string
}

func toDTO(item *domain.Item) ItemDTO {
	links := make([]LinkDTO, 0, len(item.Links()))
	for _, link := range item.Links() {
		links = append(links, LinkDTO{Label: link.Label, URL: link.URL})
	}
	checklist := make([]ChecklistItemDTO, 0, len(item.Checklist()))
	for _, entry := range item.Checklist() {
		checklist = append(checklist, ChecklistItemDTO{Text: entry.Text, Done: entry.Done})
	}
	dto := ItemDTO{ID: item.ID().String(), ProjectID: item.ProjectID().String(), Number: item.Number(),
		Title: item.Title(), Description: item.Description(), Stage: string(item.Stage()), Position: item.Position(),
		Tags: item.Tags(), Links: links, Checklist: checklist, DeliveredVersion: item.DeliveredVersion(),
		CreatedAt: item.CreatedAt().Format(time.RFC3339), UpdatedAt: item.UpdatedAt().Format(time.RFC3339)}
	if date := item.CompletionDate(); date != nil {
		formatted := date.Format(time.DateOnly)
		dto.CompletionDate = &formatted
	}
	return dto
}

func progressOf(items []*domain.Item) ProgressDTO {
	var progress ProgressDTO
	for _, item := range items {
		if item.DeletedAt() != nil {
			continue
		}
		progress.Total++
		switch item.Stage() {
		case domain.Planned:
			progress.Planned++
		case domain.InProgress:
			progress.InProgress++
		case domain.Completed:
			progress.Completed++
		}
	}
	if progress.Total > 0 {
		progress.Percent = (progress.Completed*100 + progress.Total/2) / progress.Total
	}
	return progress
}
