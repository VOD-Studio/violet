// Package note 定义笔记聚合的领域模型。
//
// 笔记是轻量知识条目（AI 会话沉淀与手工记录共用载体）：markdown 正文 +
// 标签名快照，标题可选。状态机 draft→published 单向，无撤回为草稿的路径
// （误发走编辑或删除）。与文章（重打磨作品）、推文（社交广播）是三个
// 平级内容类型，不进主博客流与推文时间线。
package note

import (
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 笔记状态
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

// 领域约束
const (
	// MaxTitleRunes 标题长度上限（Unicode 字符）；空串表示无标题。
	MaxTitleRunes = 120
	// MaxTagCount 单条笔记标签数上限（去重后计）。
	MaxTagCount = 8
)

// PublishedCursor 公开流稳定排序键。
type PublishedCursor struct {
	// PublishedAt 首次发布时间。
	PublishedAt time.Time
	// ID 同一发布时间下的唯一排序键。
	ID shared.ID
}

// PublishedNote 公开只读投影，只携带已发布内容。
type PublishedNote struct {
	// ID 笔记唯一标识（公开地址即用 ID）。
	ID shared.ID
	// Title 标题，空串表示无标题。
	Title string
	// ContentHTML 阅读端权威渲染源。
	ContentHTML string
	// Tags 标签名列表。
	Tags []string
	// PublishedAt 首次发布时间。
	PublishedAt time.Time
}

var (
	// ErrNotFound 笔记不存在。
	ErrNotFound = shared.NotFound("笔记")
)

// Note 笔记聚合根
type Note struct {
	shared.AggregateRoot

	// id 笔记唯一标识；公开地址即用 ID（标题可选，不设 slug）
	id shared.ID
	// title 标题，可空（空串=无标题）；非空时不超过 120 个 Unicode 字符
	title string
	// contentMD 正文 Markdown 源文本，去空白后非空
	contentMD string
	// contentHTML 由 contentMD 经 markdown 管线预渲染的 HTML，阅读端权威源
	contentHTML string
	// status 状态机当前值：draft / published，单向 draft→published
	status string
	// authorID 作者用户 ID，创建后不变
	authorID shared.ID
	// publishedAt 首次发布时间；仅 status=published 时非 nil，发布后编辑不改动
	publishedAt *time.Time
	// createdAt 创建时间
	createdAt time.Time
	// updatedAt 最近编辑时间
	updatedAt time.Time
	// tags 标签名列表快照（多对多关联的快照，同 post 建模），去重后 0–8 个
	tags []string
}

// NewNote 创建草稿笔记；校验失败返回领域错误。
func NewNote(id, authorID shared.ID, title, contentMD string, tags []string) (*Note, error) {
	n := &Note{id: id, authorID: authorID, status: StatusDraft}
	if err := n.applyContent(title, contentMD, tags); err != nil {
		return nil, err
	}
	return n, nil
}

// Reconstruct 从持久层重建聚合，不校验、不发事件。
func Reconstruct(
	id, authorID shared.ID,
	title, contentMD, contentHTML, status string,
	publishedAt *time.Time,
	createdAt, updatedAt time.Time,
	tags []string,
) *Note {
	return &Note{
		id: id, authorID: authorID,
		title: title, contentMD: contentMD, contentHTML: contentHTML,
		status: status, publishedAt: publishedAt,
		createdAt: createdAt, updatedAt: updatedAt,
		tags: tags,
	}
}

// Edit 全量替换可编辑内容（标题/正文/标签）；状态与发布时间不变。
func (n *Note) Edit(title, contentMD, contentHTML string, tags []string) error {
	if err := n.applyContent(title, contentMD, tags); err != nil {
		return err
	}
	n.contentHTML = contentHTML
	return nil
}

// Publish 发布：draft→published 并盖首次发布时间。
// 已发布时为幂等 no-op——不报错也不刷新时间，后台重复点发布无副作用。
func (n *Note) Publish(now time.Time) {
	if n.status == StatusPublished {
		return
	}
	n.status = StatusPublished
	t := now
	n.publishedAt = &t
}

// applyContent 校验并落标题/正文/标签，创建与编辑共用。
func (n *Note) applyContent(title, contentMD string, tags []string) error {
	title = strings.TrimSpace(title)
	if utf8.RuneCountInString(title) > MaxTitleRunes {
		return shared.BadRequest("笔记标题不能超过 120 个字符")
	}
	if strings.TrimSpace(contentMD) == "" {
		return shared.BadRequest("笔记正文不能为空")
	}
	cleaned := normalizeTags(tags)
	if len(cleaned) > MaxTagCount {
		return shared.BadRequest("笔记标签最多 8 个")
	}
	n.title = title
	n.contentMD = contentMD
	n.tags = cleaned
	return nil
}

// normalizeTags 去空白、去空项、按原顺序去重。
func normalizeTags(tags []string) []string {
	seen := make(map[string]struct{}, len(tags))
	out := make([]string, 0, len(tags))
	for _, t := range tags {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		out = append(out, t)
	}
	return out
}

func (n *Note) ID() shared.ID           { return n.id }
func (n *Note) AuthorID() shared.ID     { return n.authorID }
func (n *Note) Title() string           { return n.title }
func (n *Note) ContentMD() string       { return n.contentMD }
func (n *Note) ContentHTML() string     { return n.contentHTML }
func (n *Note) Status() string          { return n.status }
func (n *Note) PublishedAt() *time.Time { return n.publishedAt }
func (n *Note) CreatedAt() time.Time    { return n.createdAt }
func (n *Note) UpdatedAt() time.Time    { return n.updatedAt }
func (n *Note) Tags() []string          { return n.tags }

// IsPublished 是否处于已发布态。
func (n *Note) IsPublished() bool { return n.status == StatusPublished }
