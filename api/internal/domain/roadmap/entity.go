// Package roadmap 定义项目路线图条目与阶段规则。
package roadmap

import (
	"encoding/json"
	"net/url"
	"slices"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

type Stage string

const (
	Planned    Stage = "planned"
	InProgress Stage = "in_progress"
	Completed  Stage = "completed"
)

func (s Stage) Valid() bool { return s == Planned || s == InProgress || s == Completed }

type Link struct {
	// Label 链接显示文字；空串时使用方显示 URL。
	Label string `json:"label"`
	// URL http(s) 网址或以单个斜线开头的站内路径。
	URL string `json:"url"`
}

type Content struct {
	// Title 必填的纯文本标题。
	Title string
	// Description 纯文本简介，不作 Markdown 或 HTML 解释。
	Description string
	// Tags 项目内自由输入的短文本，不关联文章标签。
	Tags []string
	// Links 仅供跳转的关联网址，不同步外部状态。
	Links []Link
	// CompletionDate 已完成条目的日历日期；创建时 nil 表示当天，编辑时由应用层保留旧值。
	CompletionDate *time.Time
	// DeliveredVersion 自由文本版本号，仅已完成阶段允许非空。
	DeliveredVersion string
}

type ItemState struct {
	// ID 条目的稳定身份，软删除与恢复均不改变。
	ID shared.ID
	// ProjectID 条目所属项目，创建后不可改变。
	ProjectID shared.ID
	// Number 所属项目内单调递增且永不复用的编号。
	Number int64
	// Content 条目的可编辑内容。
	Content Content
	// Stage 当前阶段，全站固定为三种取值。
	Stage Stage
	// Position 按字节序排序的分数索引；已完成阶段忽略此字段。
	Position string
	// DeletedAt nil 表示活跃；非空时公开读取隐藏条目。
	DeletedAt *time.Time
	// CreatedAt 首次创建时间。
	CreatedAt time.Time
	// UpdatedAt 最近一次内容、阶段、顺序或删除状态变化的时间。
	UpdatedAt time.Time
}

type Item struct {
	shared.AggregateRoot
	// state 通过领域操作维护的条目快照。
	state ItemState
}

func NewItem(id, projectID shared.ID, number int64, content Content, stage Stage, position string, now time.Time) (*Item, error) {
	if id.IsZero() || projectID.IsZero() || number < 1 {
		return nil, shared.BadRequest("路线图条目标识或编号无效")
	}
	if !stage.Valid() {
		return nil, shared.BadRequest("路线图阶段无效")
	}
	if !ValidPosition(position) {
		return nil, shared.BadRequest("路线图排序键无效")
	}
	content, err := normalizeContent(content, stage, now)
	if err != nil {
		return nil, err
	}
	i := ReconstructItem(ItemState{ID: id, ProjectID: projectID, Number: number, Content: content,
		Stage: stage, Position: position, CreatedAt: now, UpdatedAt: now})
	i.RecordEvent(ItemCreated{BaseEvent: shared.NewBaseEvent("roadmap.item.created", id),
		ProjectID: projectID, Number: number, Title: content.Title})
	return i, nil
}

func ReconstructItem(state ItemState) *Item {
	state.Content = cloneContent(state.Content)
	state.DeletedAt = cloneTime(state.DeletedAt)
	i := &Item{state: state}
	i.SetID(state.ID)
	return i
}

// UpdateContent 编辑内容，阶段与排序只能通过移动操作改变。
func (i *Item) UpdateContent(content Content, now time.Time) error {
	if i.DeletedAt() != nil {
		return ErrNotFound
	}
	next, err := normalizeContent(content, i.Stage(), now)
	if err != nil {
		return err
	}
	changes := contentChanges(i.state.Content, next)
	if len(changes) == 0 {
		return nil
	}
	i.state.Content = next
	i.state.UpdatedAt = now
	i.RecordEvent(ItemUpdated{BaseEvent: shared.NewBaseEvent("roadmap.item.updated", i.ID()),
		ProjectID: i.ProjectID(), Number: i.Number(), Title: i.Title(), Changes: changes})
	return nil
}

func (i *Item) ID() shared.ID              { return i.state.ID }
func (i *Item) ProjectID() shared.ID       { return i.state.ProjectID }
func (i *Item) Number() int64              { return i.state.Number }
func (i *Item) Title() string              { return i.state.Content.Title }
func (i *Item) Description() string        { return i.state.Content.Description }
func (i *Item) Stage() Stage               { return i.state.Stage }
func (i *Item) Position() string           { return i.state.Position }
func (i *Item) Tags() []string             { return slices.Clone(i.state.Content.Tags) }
func (i *Item) Links() []Link              { return slices.Clone(i.state.Content.Links) }
func (i *Item) CompletionDate() *time.Time { return cloneTime(i.state.Content.CompletionDate) }
func (i *Item) DeliveredVersion() string   { return i.state.Content.DeliveredVersion }
func (i *Item) DeletedAt() *time.Time      { return cloneTime(i.state.DeletedAt) }
func (i *Item) CreatedAt() time.Time       { return i.state.CreatedAt }
func (i *Item) UpdatedAt() time.Time       { return i.state.UpdatedAt }

func normalizeContent(c Content, stage Stage, now time.Time) (Content, error) {
	c.Title = strings.TrimSpace(c.Title)
	if c.Title == "" {
		return Content{}, shared.BadRequest("路线图条目标题不能为空")
	}
	c.Tags = normalizeTags(c.Tags)
	c.Links = slices.Clone(c.Links)
	if c.Links == nil {
		c.Links = []Link{}
	}
	for _, link := range c.Links {
		if !validLink(link.URL) {
			return Content{}, shared.BadRequest("路线图关联链接必须是 http(s) 网址或站内路径")
		}
	}
	if stage != Completed {
		if c.CompletionDate != nil || c.DeliveredVersion != "" {
			return Content{}, shared.BadRequest("完成日期与交付版本仅用于已完成条目")
		}
		return c, nil
	}
	date := now
	if c.CompletionDate != nil {
		date = *c.CompletionDate
	}
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.UTC)
	c.CompletionDate = &date
	return c, nil
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := make(map[string]bool, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag != "" && !seen[tag] {
			out = append(out, tag)
			seen[tag] = true
		}
	}
	return out
}

func validLink(raw string) bool {
	if strings.ContainsAny(raw, "\\\r\n") {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.User != nil {
		return false
	}
	if strings.HasPrefix(raw, "/") && !strings.HasPrefix(raw, "//") {
		return u.Scheme == "" && u.Host == ""
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != ""
}

func cloneTime(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	copy := *t
	return &copy
}

func cloneContent(c Content) Content {
	c.Tags = slices.Clone(c.Tags)
	if c.Tags == nil {
		c.Tags = []string{}
	}
	c.Links = slices.Clone(c.Links)
	if c.Links == nil {
		c.Links = []Link{}
	}
	c.CompletionDate = cloneTime(c.CompletionDate)
	return c
}

func contentChanges(before, after Content) []Change {
	changes := make([]Change, 0, 6)
	add := func(field, from, to string) {
		if from != to {
			changes = append(changes, Change{Field: field, From: from, To: to})
		}
	}
	add("title", before.Title, after.Title)
	add("description", before.Description, after.Description)
	beforeTags, _ := json.Marshal(before.Tags)
	afterTags, _ := json.Marshal(after.Tags)
	add("tags", string(beforeTags), string(afterTags))
	beforeLinks, _ := json.Marshal(before.Links)
	afterLinks, _ := json.Marshal(after.Links)
	add("links", string(beforeLinks), string(afterLinks))
	add("completion_date", formatDate(before.CompletionDate), formatDate(after.CompletionDate))
	add("delivered_version", before.DeliveredVersion, after.DeliveredVersion)
	return changes
}

func formatDate(date *time.Time) string {
	if date == nil {
		return ""
	}
	return date.Format(time.DateOnly)
}
