package roadmap

import (
	"time"

	"blog-api/internal/domain/shared"
)

type ItemDeleted struct {
	shared.BaseEvent
	// ProjectID 条目所属项目。
	ProjectID shared.ID
	// Number 项目内稳定编号，软删除后不释放。
	Number int64
	// Title 删除时的标题快照。
	Title string
}

type ItemRestored struct {
	shared.BaseEvent
	// ProjectID 条目所属项目。
	ProjectID shared.ID
	// Number 恢复的原有编号。
	Number int64
	// Title 恢复时的标题快照。
	Title string
}

// SoftDelete 保留身份、内容与位置；重复删除不刷新时间或记录事件。
func (i *Item) SoftDelete(now time.Time) {
	if i.state.DeletedAt != nil {
		return
	}
	i.state.DeletedAt = cloneTime(&now)
	i.state.UpdatedAt = now
	i.RecordEvent(ItemDeleted{BaseEvent: shared.NewBaseEvent("roadmap.item.deleted", i.ID()),
		ProjectID: i.ProjectID(), Number: i.Number(), Title: i.Title()})
}

// Restore 恢复同一条目；重复恢复不刷新时间或记录事件。
func (i *Item) Restore(now time.Time) {
	if i.state.DeletedAt == nil {
		return
	}
	i.state.DeletedAt = nil
	i.state.UpdatedAt = now
	i.RecordEvent(ItemRestored{BaseEvent: shared.NewBaseEvent("roadmap.item.restored", i.ID()),
		ProjectID: i.ProjectID(), Number: i.Number(), Title: i.Title()})
}
