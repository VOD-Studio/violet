// Package emoji 定义表情聚合的领域模型。
package emoji

import "blog-api/internal/domain/shared"

// 表情来源类型
const (
	SourceSystem   = "system"
	SourceBilibili = "bilibili"
)

// EmojiGroup 表情分组聚合根
type EmojiGroup struct {
	shared.AggregateRoot
	id        int32
	name      string
	source    string
	coverURL  string
	sortOrder int
	isEnabled bool
	emojis    []Emoji
}

// Emoji 表情实体（属于分组）
type Emoji struct {
	id          int32
	groupID     int32
	name        string
	url         string
	sourceURL   string
	gifURL      string
	textContent string
	sortOrder   int
}

// NewEmojiGroup 创建表情分组
func NewEmojiGroup(id int32, name, source string) (*EmojiGroup, error) {
	if name == "" {
		return nil, shared.BadRequest("分组名称不能为空")
	}
	if source == "" {
		source = SourceCustom
	}
	return &EmojiGroup{id: id, name: name, source: source, isEnabled: true, emojis: []Emoji{}}, nil
}

func ReconstructEmojiGroup(id int32, name, source, coverURL string, sortOrder int, isEnabled bool, emojis []Emoji) *EmojiGroup {
	if emojis == nil {
		emojis = []Emoji{}
	}
	return &EmojiGroup{id: id, name: name, source: source, coverURL: coverURL, sortOrder: sortOrder, isEnabled: isEnabled, emojis: emojis}
}

// 表情来源类型完整枚举
const (
	SourceCustom = "custom"
)

// SetEnabled 启用/禁用分组
func (g *EmojiGroup) SetEnabled(enabled bool) { g.isEnabled = enabled }

// SetSortOrder 设置排序
func (g *EmojiGroup) SetSortOrder(order int) { g.sortOrder = order }

// SetName 设置分组名称
func (g *EmojiGroup) SetName(name string) {
	if name != "" {
		g.name = name
	}
}

// SetSource 设置来源
func (g *EmojiGroup) SetSource(source string) {
	if source != "" {
		g.source = source
	}
}

// SetCoverURL 设置封面图 URL
func (g *EmojiGroup) SetCoverURL(coverURL string) {
	g.coverURL = coverURL
}

// SetEmojis 设置分组内表情列表
func (g *EmojiGroup) SetEmojis(emojis []Emoji) {
	if emojis == nil {
		emojis = []Emoji{}
	}
	g.emojis = emojis
}
func (g *EmojiGroup) ID() int32        { return g.id }
func (g *EmojiGroup) Name() string     { return g.name }
func (g *EmojiGroup) Source() string   { return g.source }
func (g *EmojiGroup) CoverURL() string { return g.coverURL }
func (g *EmojiGroup) SortOrder() int   { return g.sortOrder }
func (g *EmojiGroup) IsEnabled() bool  { return g.isEnabled }
func (g *EmojiGroup) Emojis() []Emoji  { return g.emojis }

// NewEmoji 创建表情（基础字段）
func NewEmoji(id, groupID int32, name, url string) Emoji {
	return Emoji{id: id, groupID: groupID, name: name, url: url}
}

// ReconstructEmoji 从持久化数据重建表情（完整字段）
func ReconstructEmoji(id, groupID int32, name, url, sourceURL, gifURL, textContent string, sortOrder int) Emoji {
	return Emoji{
		id: id, groupID: groupID, name: name, url: url,
		sourceURL: sourceURL, gifURL: gifURL,
		textContent: textContent, sortOrder: sortOrder,
	}
}

// Update 修改表情字段（空值不覆盖）
func (e *Emoji) Update(name, url, textContent, gifURL, sourceURL string, sortOrder int) {
	if name != "" {
		e.name = name
	}
	if url != "" {
		e.url = url
	}
	if textContent != "" {
		e.textContent = textContent
	}
	if gifURL != "" {
		e.gifURL = gifURL
	}
	if sourceURL != "" {
		e.sourceURL = sourceURL
	}
	e.sortOrder = sortOrder
}

func (e Emoji) ID() int32           { return e.id }
func (e Emoji) GroupID() int32      { return e.groupID }
func (e Emoji) Name() string        { return e.name }
func (e Emoji) URL() string         { return e.url }
func (e Emoji) SourceURL() string   { return e.sourceURL }
func (e Emoji) GifURL() string      { return e.gifURL }
func (e Emoji) TextContent() string { return e.textContent }
func (e Emoji) SortOrder() int      { return e.sortOrder }
