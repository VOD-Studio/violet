package roadmap

import (
	"time"

	"blog-api/internal/domain/shared"
)

type ItemStageChanged struct {
	shared.BaseEvent
	// ProjectID 条目所属项目。
	ProjectID shared.ID
	// Number 项目内稳定编号。
	Number int64
	// Title 阶段变更时的标题快照。
	Title string
	// From 变更前的阶段。
	From Stage
	// To 变更后的阶段。
	To Stage
}

// Move 更改阶段或手动顺序；已完成阶段拒绝同阶段重排。
func (i *Item) Move(stage Stage, position string, completionDate *time.Time, version string, now time.Time) error {
	if i.DeletedAt() != nil {
		return ErrNotFound
	}
	if !stage.Valid() {
		return shared.BadRequest("路线图阶段无效")
	}
	if i.Stage() == Completed && stage == Completed {
		return shared.BadRequest("已完成阶段按完成日期排序，不接受手动重排")
	}
	if !ValidPosition(position) {
		return shared.BadRequest("路线图排序键无效")
	}
	content := cloneContent(i.state.Content)
	content.CompletionDate = nil
	content.DeliveredVersion = ""
	if stage == Completed {
		content.CompletionDate = completionDate
		content.DeliveredVersion = version
	}
	content, err := normalizeContent(content, stage, now)
	if err != nil {
		return err
	}
	previous := i.Stage()
	if previous == stage && i.Position() == position {
		return nil
	}
	i.state.Content = content
	i.state.Stage = stage
	i.state.Position = position
	i.state.UpdatedAt = now
	if previous != stage {
		i.RecordEvent(ItemStageChanged{BaseEvent: shared.NewBaseEvent("roadmap.item.stage_changed", i.ID()),
			ProjectID: i.ProjectID(), Number: i.Number(), Title: i.Title(), From: previous, To: stage})
	}
	return nil
}
