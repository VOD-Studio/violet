package note

import "blog-api/internal/domain/shared"

// Type 为作者声明的手记类别，与发布状态无关。
type Type string

const (
	TypeUnclassified Type = "unclassified"
	TypePitfall      Type = "pitfall"
	TypeIdea         Type = "idea"
	TypeExcerpt      Type = "excerpt"
)

func (t Type) IsValid() bool {
	switch t {
	case TypeUnclassified, TypePitfall, TypeIdea, TypeExcerpt:
		return true
	default:
		return false
	}
}

// Pitfall 是踩坑手记中独立于正文的记录。
type Pitfall struct {
	// Symptom 现象；空串表示未填写。
	Symptom string
	// Cause 根因；空串表示未查明或未填写。
	Cause string
	// Remedy 修法；空串表示未填写。
	Remedy string
	// Resolved 由作者明确标记是否解决，不根据修法推断。
	Resolved bool
	// Code 供阅读者复制的原始代码，保留空格和换行。
	Code string
}

// Journal 描述手记在时间线上的分类、项目和结构化内容。
type Journal struct {
	// Type 历史记录与未分类记录使用 TypeUnclassified。
	Type Type
	// ProjectID nil 表示未关联公开项目。
	ProjectID *shared.ID
	// Pitfall 仅踩坑手记有值。
	Pitfall *Pitfall
}

func (j Journal) validate() error {
	if !j.Type.IsValid() {
		return shared.BadRequest("手记类型无效")
	}
	if (j.Type == TypePitfall) != (j.Pitfall != nil) {
		return shared.BadRequest("仅踩坑类型必须包含踩坑信息")
	}
	return nil
}

// PublishedProject 是公开手记允许展示的项目摘要。
type PublishedProject struct {
	// ID 与项目筛选使用同一标识。
	ID shared.ID
	// Title 项目公开名称，随项目改名更新。
	Title string
}
