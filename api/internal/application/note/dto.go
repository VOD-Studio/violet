package note

import (
	"time"

	domainnote "blog-api/internal/domain/note"
)

// NoteDTO 后台笔记详情（含草稿态与 Markdown 源）。
type NoteDTO struct {
	ID       string `json:"id"`
	AuthorID string `json:"author_id"`
	// Title 空串表示无标题。
	Title string `json:"title"`
	// Status 为 draft 或 published。
	Status string `json:"status"`
	// ContentMD 编辑态正文源。
	ContentMD string `json:"content_md"`
	// ContentHTML 阅读端权威渲染源。
	ContentHTML string   `json:"content_html"`
	Tags        []string `json:"tags"`
	// CreatedAt / UpdatedAt RFC3339。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	// PublishedAt nil 表示从未发布；非 nil 为 RFC3339。
	PublishedAt *string    `json:"published_at"`
	Journal     JournalDTO `json:"journal"`
}

// NoteSummaryDTO 后台笔记列表项，不含正文。
type NoteSummaryDTO struct {
	ID          string   `json:"id"`
	AuthorID    string   `json:"author_id"`
	Title       string   `json:"title"`
	Status      string   `json:"status"`
	Tags        []string `json:"tags"`
	CreatedAt   string   `json:"created_at"`
	UpdatedAt   string   `json:"updated_at"`
	PublishedAt *string  `json:"published_at"`
}

// PublicNoteDTO 公开笔记投影（阅读端）。
type PublicNoteDTO struct {
	ID string `json:"id"`
	// Title 空串表示无标题。
	Title string `json:"title"`
	// ContentHTML 阅读端权威渲染源。
	ContentHTML string   `json:"content_html"`
	Tags        []string `json:"tags"`
	// PublishedAt RFC3339。
	PublishedAt string          `json:"published_at"`
	Type        domainnote.Type `json:"type"`
	// Project 未关联或项目已移除时为 nil。
	Project *PublicNoteProjectDTO `json:"project"`
	// Pitfall 非踩坑手记为 nil。
	Pitfall *PitfallDTO `json:"pitfall"`
}

// PublicNoteProjectDTO 只包含手记公开列表和详情消费的项目字段。
type PublicNoteProjectDTO struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// PitfallDTO 空字符串表示该段未填写；Code 保留原始空格和换行。
type PitfallDTO struct {
	Symptom  string `json:"symptom"`
	Cause    string `json:"cause"`
	Remedy   string `json:"remedy"`
	Resolved bool   `json:"resolved"`
	Code     string `json:"code"`
}

// JournalDTO 非空值作为一组替换时间线元数据。
type JournalDTO struct {
	Type domainnote.Type `json:"type"`
	// ProjectID nil 时解除关联。
	ProjectID *string `json:"project_id"`
	// Pitfall 仅在 Type 为 pitfall 时必须提供。
	Pitfall *PitfallDTO `json:"pitfall"`
}

// CreateInput 创建笔记输入。
type CreateInput struct {
	UserID string
	Title  string
	// ContentMD 正文 Markdown 源，去空白后非空。
	ContentMD string
	Tags      []string
	// Journal 缺省为未分类，不从正文或标题推断类型。
	Journal *JournalDTO
}

// UpdateInput 全量保存输入；状态与发布时间不随编辑变化。
type UpdateInput struct {
	NoteID string
	Title  string
	// ContentMD 正文 Markdown 源，去空白后非空。
	ContentMD string
	Tags      []string
	// Journal 缺省时保留已保存的时间线元数据。
	Journal *JournalDTO
}

// ListQuery 管理列表查询；零值表示不过滤。
type ListQuery struct {
	// Author 只列该用户 ID 的笔记（MCP 作者视角）；空串表示全部作者。
	Author string
	// Status 取 draft 或 published；空串表示全部状态。
	Status string
	Page   int
	Limit  int
}

// BrowseQuery 公开手记的复合游标与可组合筛选。
type BrowseQuery struct {
	Cursor    string
	Limit     int
	TagSlug   string
	Type      domainnote.Type
	ProjectID string
}

func toDTO(n *domainnote.Note) NoteDTO {
	return NoteDTO{
		ID:          n.ID().String(),
		AuthorID:    n.AuthorID().String(),
		Title:       n.Title(),
		Status:      n.Status(),
		ContentMD:   n.ContentMD(),
		ContentHTML: n.ContentHTML(),
		Tags:        nonNilTags(n.Tags()),
		CreatedAt:   formatTime(n.CreatedAt()),
		UpdatedAt:   formatTime(n.UpdatedAt()),
		PublishedAt: formatTimePtr(n.PublishedAt()),
		Journal:     toJournalDTO(n.Journal()),
	}
}

func toSummaryDTO(n *domainnote.Note) NoteSummaryDTO {
	return NoteSummaryDTO{
		ID:          n.ID().String(),
		AuthorID:    n.AuthorID().String(),
		Title:       n.Title(),
		Status:      n.Status(),
		Tags:        nonNilTags(n.Tags()),
		CreatedAt:   formatTime(n.CreatedAt()),
		UpdatedAt:   formatTime(n.UpdatedAt()),
		PublishedAt: formatTimePtr(n.PublishedAt()),
	}
}

func toJournalDTO(j domainnote.Journal) JournalDTO {
	out := JournalDTO{Type: j.Type, Pitfall: (*PitfallDTO)(j.Pitfall)}
	if j.ProjectID != nil {
		id := j.ProjectID.String()
		out.ProjectID = &id
	}
	return out
}

func toPublicDTO(p domainnote.PublishedNote) PublicNoteDTO {
	var project *PublicNoteProjectDTO
	if p.Project != nil {
		project = &PublicNoteProjectDTO{ID: p.Project.ID.String(), Title: p.Project.Title}
	}
	return PublicNoteDTO{
		ID:          p.ID.String(),
		Title:       p.Title,
		ContentHTML: p.ContentHTML,
		Tags:        nonNilTags(p.Tags),
		PublishedAt: p.PublishedAt.UTC().Format(time.RFC3339),
		Type:        p.Type,
		Project:     project,
		Pitfall:     (*PitfallDTO)(p.Pitfall),
	}
}

func nonNilTags(tags []string) []string {
	if tags == nil {
		return []string{}
	}
	return tags
}

func formatTime(t time.Time) string { return t.UTC().Format(time.RFC3339) }

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := formatTime(*t)
	return &s
}
