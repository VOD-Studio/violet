package roadmap

import "blog-api/internal/domain/shared"

type Change struct {
	// Field 变更字段名，使用 HTTP 读模型的 snake_case 名称。
	Field string
	// From 变更前的可读值，列表以 JSON 表示。
	From string
	// To 变更后的可读值，列表以 JSON 表示。
	To string
}

type ItemCreated struct {
	shared.BaseEvent
	// ProjectID 条目所属项目。
	ProjectID shared.ID
	// Number 项目内稳定编号。
	Number int64
	// Title 创建时的标题快照。
	Title string
}

type ItemUpdated struct {
	shared.BaseEvent
	// ProjectID 条目所属项目。
	ProjectID shared.ID
	// Number 项目内稳定编号。
	Number int64
	// Title 编辑后的标题快照。
	Title string
	// Changes 实际发生变化的内容字段，空操作不产生事件。
	Changes []Change
}
