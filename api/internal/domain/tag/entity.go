// Package tag 提供标签的领域模型。
package tag

// Tag 标签实体
type Tag struct {
	// id 标签主键
	id int32
	// name 标签名称
	name string
	// slug URL 友好别名（由 application 层据 name 自动生成，用于路由与去重）
	slug string
}

// NewTag 创建标签（自动生成 slug 由 application 层完成）
func NewTag(id int32, name, slug string) Tag {
	return Tag{id: id, name: name, slug: slug}
}

func (t Tag) ID() int32    { return t.id }
func (t Tag) Name() string { return t.name }
func (t Tag) Slug() string { return t.slug }
