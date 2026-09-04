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
	PublishedAt *string `json:"published_at"`
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
	PublishedAt string `json:"published_at"`
}

// CreateInput 创建笔记输入。
type CreateInput struct {
	UserID string
	Title  string
	// ContentMD 正文 Markdown 源，去空白后非空。
	ContentMD string
	Tags      []string
}

// UpdateInput 全量保存输入；状态与发布时间不随编辑变化。
type UpdateInput struct {
	NoteID string
	Title  string
	// ContentMD 正文 Markdown 源，去空白后非空。
	ContentMD string
	Tags      []string
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

func toPublicDTO(p domainnote.PublishedNote) PublicNoteDTO {
	return PublicNoteDTO{
		ID:          p.ID.String(),
		Title:       p.Title,
		ContentHTML: p.ContentHTML,
		Tags:        nonNilTags(p.Tags),
		PublishedAt: p.PublishedAt.UTC().Format(time.RFC3339),
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
