package audit

import (
	"fmt"

	domainaudit "blog-api/internal/domain/audit"
	"blog-api/internal/domain/roadmap"
	"blog-api/internal/domain/shared"
)

func mapRoadmapEvent(actor domainaudit.Actor, event shared.DomainEvent) (domainaudit.AuditEvent, bool) {
	entry := domainaudit.AuditEvent{EventID: event.EventID(), Actor: actor, OccurredAt: event.OccurredAt()}
	switch e := event.(type) {
	case roadmap.ItemCreated:
		entry.Action = domainaudit.ActionCreate
		entry.Resource = domainaudit.ResourceRef{Type: "roadmap_item", ID: e.AggregateID().String(), Name: roadmapResourceName(e.Title)}
		entry.Metadata = map[string]any{"project_id": e.ProjectID.String(), "number": e.Number}
		entry.Summary = fmt.Sprintf("新增路线图条目 #%d %s", e.Number, e.Title)
	case roadmap.ItemUpdated:
		entry.Action = domainaudit.ActionUpdate
		entry.Resource = domainaudit.ResourceRef{Type: "roadmap_item", ID: e.AggregateID().String(), Name: roadmapResourceName(e.Title)}
		entry.Metadata = map[string]any{"project_id": e.ProjectID.String(), "number": e.Number}
		entry.Summary = fmt.Sprintf("编辑路线图条目 #%d %s", e.Number, e.Title)
		for _, change := range e.Changes {
			entry.Changes = append(entry.Changes, domainaudit.FieldChange{Field: change.Field, From: change.From, To: change.To})
		}
	case roadmap.ItemStageChanged:
		entry.Action = domainaudit.ActionUpdate
		entry.Resource = domainaudit.ResourceRef{Type: "roadmap_item", ID: e.AggregateID().String(), Name: roadmapResourceName(e.Title)}
		entry.Metadata = map[string]any{"project_id": e.ProjectID.String(), "number": e.Number}
		entry.Summary = fmt.Sprintf("变更路线图条目 #%d %s 的阶段", e.Number, e.Title)
		entry.Changes = []domainaudit.FieldChange{{Field: "stage", From: string(e.From), To: string(e.To)}}
	default:
		return domainaudit.AuditEvent{}, false
	}
	return entry, true
}

func roadmapResourceName(title string) string {
	// 审计资源名列最多 255 字符，完整标题仍保留在 summary 中。
	runes := []rune(title)
	if len(runes) > 255 {
		return string(runes[:255])
	}
	return title
}
