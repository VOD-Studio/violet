// Package series 定义系列书聚合的领域模型（PRD-0021）。
//
// 书是持续生长的组织容器，不是一次性合并转换：建书 → 挂章 → 调序补章。
// 章节不内嵌在本聚合里——归属由 posts.series_id + posts.series_section_id +
// posts.chapter_order 承载，章节仍是完整 Post 聚合（独立 URL、版本、评论）。
//
// 目录结构（两层，不做无限树）：
//
//	书根章节（无卷） → 卷/部（SeriesSection） → 卷内章节
//
// 展示顺序：根章节在前（chapter_order 升序），各卷按 sort_order 升序依次排列。
//
// 状态机（两态）：draft → published → draft（可收回）；draft 不出现在公开书架。
//
// 不变量：
//   - authorID 创建时固定，无 setter（协作写书明确不支持）
//   - slug 创建时定，唯一且不可改（外部标识稳定）
//   - section sort_order 由聚合统一分配，一书内不重复
package series

import (
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 状态枚举
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

// IsValidStatus 校验状态合法性
func IsValidStatus(s string) bool {
	return s == StatusDraft || s == StatusPublished
}

// 字段长度上限（rune 计，中文按 1 字）
const (
	maxTitleLen       = 255
	maxDescriptionLen = 2000
)

// slugPattern 同 post slug 规则：小写字母/数字/连字符
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// IsValidSlug 校验 slug 格式
func IsValidSlug(s string) bool {
	return slugPattern.MatchString(s)
}

// ============================================================
// 领域事件（订阅者：审计服务）
//
// 聚合根用 UUID 主键（创建时已知），全部事件在聚合根内 RecordEvent，
// 应用层 PullEvents 后发布。SeriesDeleted 例外：删除后聚合不存在，
// 由应用层手动构造发布。
// ============================================================

// SeriesCreated 书已创建事件
type SeriesCreated struct {
	shared.BaseEvent
	// Title 书名快照（审计可读标识）
	Title string
	// Slug 书 slug
	Slug string
}

// NewSeriesCreated 构造书创建事件
func NewSeriesCreated(id shared.ID, title, slug string) SeriesCreated {
	return SeriesCreated{
		BaseEvent: shared.NewBaseEvent("series.created", id),
		Title:     title,
		Slug:      slug,
	}
}

// SeriesChange 书单字段变更（before/after）
type SeriesChange struct {
	Field string
	From  string
	To    string
}

// SeriesUpdated 书已更新事件（字段 diff）
type SeriesUpdated struct {
	shared.BaseEvent
	// Title 书名快照
	Title string
	// Changes 变更字段列表（before/after）
	Changes []SeriesChange
}

// NewSeriesUpdated 构造书更新事件
func NewSeriesUpdated(id shared.ID, title string, changes []SeriesChange) SeriesUpdated {
	return SeriesUpdated{
		BaseEvent: shared.NewBaseEvent("series.updated", id),
		Title:     title,
		Changes:   changes,
	}
}

// SeriesPublished 书已发布事件
type SeriesPublished struct {
	shared.BaseEvent
	// Title 书名快照
	Title string
}

// NewSeriesPublished 构造书发布事件
func NewSeriesPublished(id shared.ID, title string) SeriesPublished {
	return SeriesPublished{
		BaseEvent: shared.NewBaseEvent("series.published", id),
		Title:     title,
	}
}

// SeriesUnpublished 书已收回事件（published → draft）
type SeriesUnpublished struct {
	shared.BaseEvent
	// Title 书名快照
	Title string
}

// NewSeriesUnpublished 构造书收回事件
func NewSeriesUnpublished(id shared.ID, title string) SeriesUnpublished {
	return SeriesUnpublished{
		BaseEvent: shared.NewBaseEvent("series.unpublished", id),
		Title:     title,
	}
}

// SectionAdded 卷/部已添加事件
type SectionAdded struct {
	shared.BaseEvent
	// SectionTitle 卷名快照
	SectionTitle string
}

// NewSectionAdded 构造卷添加事件
func NewSectionAdded(seriesID shared.ID, sectionTitle string) SectionAdded {
	return SectionAdded{
		BaseEvent:    shared.NewBaseEvent("series.section.added", seriesID),
		SectionTitle: sectionTitle,
	}
}

// SectionRemoved 卷/部已移除事件
type SectionRemoved struct {
	shared.BaseEvent
	// SectionTitle 卷名快照
	SectionTitle string
}

// NewSectionRemoved 构造卷移除事件
func NewSectionRemoved(seriesID shared.ID, sectionTitle string) SectionRemoved {
	return SectionRemoved{
		BaseEvent:    shared.NewBaseEvent("series.section.removed", seriesID),
		SectionTitle: sectionTitle,
	}
}

// SeriesDeleted 书已解散事件。
//
// 物理删除后聚合根不可继续存在，事件由应用层手动构造发布。
type SeriesDeleted struct {
	shared.BaseEvent
	// Title 书名快照
	Title string
}

// NewSeriesDeleted 构造书解散事件
func NewSeriesDeleted(id shared.ID, title string) SeriesDeleted {
	return SeriesDeleted{
		BaseEvent: shared.NewBaseEvent("series.deleted", id),
		Title:     title,
	}
}

// ============================================================
// 聚合根
// ============================================================

// SeriesSection 书内卷/部子实体
type SeriesSection struct {
	// id 卷 ID
	id shared.ID
	// title 卷名
	title string
	// sortOrder 卷在书内的顺序（越小越靠前，一书内不重复）
	sortOrder int
}

// ID 返回卷 ID
func (s *SeriesSection) ID() shared.ID { return s.id }

// Title 返回卷名
func (s *SeriesSection) Title() string { return s.title }

// SortOrder 返回卷顺序
func (s *SeriesSection) SortOrder() int { return s.sortOrder }

// Series 系列书聚合根
type Series struct {
	shared.AggregateRoot

	// id 书 ID
	id shared.ID
	// authorID 归属作者，创建时固定，不可变（书只能装 owner 自己的文章）
	authorID shared.ID
	// title 书名（必填，≤255 rune）
	title string
	// slug 唯一外部标识，格式同 post slug，创建后不可改
	slug string
	// description 书简介（可空，≤2000 rune）
	description string
	// coverImage 封面图 URL（可空；空则前端用无图书封规则）
	coverImage string
	// status 两态：draft / published
	status string
	// sections 卷/部列表（按 sortOrder 升序维护）
	sections []*SeriesSection
	// timestamps 创建/更新时间戳
	timestamps shared.Timestamps
}

// validateFields 构造与更新共用的字段校验。
func validateFields(title, description, coverImage string) error {
	if strings.TrimSpace(title) == "" {
		return shared.BadRequest("书名不能为空")
	}
	if utf8.RuneCountInString(strings.TrimSpace(title)) > maxTitleLen {
		return shared.BadRequest("书名不能超过 255 个字符")
	}
	if utf8.RuneCountInString(strings.TrimSpace(description)) > maxDescriptionLen {
		return shared.BadRequest("简介不能超过 2000 个字符")
	}
	// 对齐 post 域惯例：封面存素材库回填的相对路径（/uploads/...）或外链 http(s)，
	// 只拦伪协议（javascript:/data:），不强制绝对地址
	if strings.TrimSpace(coverImage) != "" && !isSafeImageRef(coverImage) {
		return shared.BadRequest("封面图地址不合法")
	}
	return nil
}

// isSafeImageRef 校验封面引用安全：http(s) 绝对地址或站内相对路径，
// 拒绝 javascript:/data: 等伪协议（防进前台渲染）。
func isSafeImageRef(raw string) bool {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "/") {
		return true // 站内相对路径（素材库上传文件）
	}
	u, err := url.Parse(trimmed)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

// NewSeries 创建新书（初始态 draft，未挂章不出现在公开书架）。
func NewSeries(id, authorID shared.ID, title, slug, description, coverImage string) (*Series, error) {
	if err := validateFields(title, description, coverImage); err != nil {
		return nil, err
	}
	if !IsValidSlug(slug) {
		return nil, shared.BadRequest("slug 格式不合法：仅小写字母、数字与连字符")
	}
	if authorID.IsZero() {
		return nil, shared.BadRequest("作者不能为空")
	}
	s := &Series{
		id:          id,
		authorID:    authorID,
		title:       strings.TrimSpace(title),
		slug:        slug,
		description: strings.TrimSpace(description),
		coverImage:  strings.TrimSpace(coverImage),
		status:      StatusDraft,
		sections:    make([]*SeriesSection, 0),
	}
	s.RecordEvent(NewSeriesCreated(s.id, s.title, s.slug))
	return s, nil
}

// ReconstructSeries 从持久化数据重建（无校验、无副作用、不记录事件）。
//
// sections 须已按 sortOrder 升序传入。
func ReconstructSeries(
	id, authorID shared.ID,
	title, slug, description, coverImage, status string,
	sections []*SeriesSection,
	createdAt, updatedAt time.Time,
) *Series {
	return &Series{
		id:          id,
		authorID:    authorID,
		title:       title,
		slug:        slug,
		description: description,
		coverImage:  coverImage,
		status:      status,
		sections:    sections,
		timestamps:  shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// ReconstructSection 从持久化数据重建卷子实体。
func ReconstructSection(id shared.ID, title string, sortOrder int) *SeriesSection {
	return &SeriesSection{id: id, title: title, sortOrder: sortOrder}
}

// ============================================================
// 状态转换（仅实际变更时 RecordEvent）
// ============================================================

// Publish 发布书（draft → published，出现在公开书架）。
func (s *Series) Publish() error {
	if s.status == StatusPublished {
		return shared.Conflict("书已处于发布状态")
	}
	s.status = StatusPublished
	s.RecordEvent(NewSeriesPublished(s.id, s.title))
	return nil
}

// Unpublish 收回书（published → draft，公开书架与书页不再可见）。
//
// 章节文章本身不受影响（仍是 published 文章），仅书的聚合视图下架。
func (s *Series) Unpublish() error {
	if s.status == StatusDraft {
		return shared.Conflict("书已处于草稿状态")
	}
	s.status = StatusDraft
	s.RecordEvent(NewSeriesUnpublished(s.id, s.title))
	return nil
}

// ============================================================
// 字段编辑
// ============================================================

// UpdateParams Update 的入参。
type UpdateParams struct {
	Title       string
	Description string
	CoverImage  string
}

// Update 编辑书名字段（任意状态可编辑；slug/authorID 不可改；状态走 Publish/Unpublish）。
//
// 仅实际变更时记录 SeriesUpdated 事件（同值直接返回，避免幂等调用产生噪音事件）。
func (s *Series) Update(p UpdateParams) error {
	if err := validateFields(p.Title, p.Description, p.CoverImage); err != nil {
		return err
	}
	changes := make([]SeriesChange, 0, 3)
	diff := func(field, from, to string) {
		if from != to {
			changes = append(changes, SeriesChange{Field: field, From: from, To: to})
		}
	}
	diff("title", s.title, strings.TrimSpace(p.Title))
	diff("description", s.description, strings.TrimSpace(p.Description))
	diff("cover_image", s.coverImage, strings.TrimSpace(p.CoverImage))
	if len(changes) == 0 {
		return nil
	}
	s.title = strings.TrimSpace(p.Title)
	s.description = strings.TrimSpace(p.Description)
	s.coverImage = strings.TrimSpace(p.CoverImage)
	s.RecordEvent(NewSeriesUpdated(s.id, s.title, changes))
	return nil
}

// ============================================================
// 卷/部管理（sortOrder 由聚合统一分配，一书内不重复）
// ============================================================

// AddSection 添加卷（排到末尾）。
func (s *Series) AddSection(id shared.ID, title string) error {
	if strings.TrimSpace(title) == "" {
		return shared.BadRequest("卷名不能为空")
	}
	if utf8.RuneCountInString(strings.TrimSpace(title)) > maxTitleLen {
		return shared.BadRequest("卷名不能超过 255 个字符")
	}
	for _, sec := range s.sections {
		if sec.id.Equal(id) {
			return shared.Conflict("卷已存在")
		}
	}
	next := 0
	if len(s.sections) > 0 {
		next = s.sections[len(s.sections)-1].sortOrder + 1
	}
	s.sections = append(s.sections, &SeriesSection{
		id:        id,
		title:     strings.TrimSpace(title),
		sortOrder: next,
	})
	s.RecordEvent(NewSectionAdded(s.id, strings.TrimSpace(title)))
	return nil
}

// SectionByID 按 ID 取卷。
func (s *Series) SectionByID(id shared.ID) (*SeriesSection, bool) {
	for _, sec := range s.sections {
		if sec.id.Equal(id) {
			return sec, true
		}
	}
	return nil, false
}

// RemoveSection 移除卷（聚合层不校验是否仍有章节挂着——
// 「非空卷拒绝删除」需要查 posts 表，由 application 层先行校验）。
func (s *Series) RemoveSection(id shared.ID) error {
	for i, sec := range s.sections {
		if sec.id.Equal(id) {
			s.sections = append(s.sections[:i], s.sections[i+1:]...)
			s.RecordEvent(NewSectionRemoved(s.id, sec.title))
			return nil
		}
	}
	return ErrSectionNotFound
}

// ReorderSections 卷全量调序：orderedIDs 必须与现有卷集合完全一致（多/少/重复均拒绝）。
func (s *Series) ReorderSections(orderedIDs []shared.ID) error {
	if len(orderedIDs) != len(s.sections) {
		return shared.BadRequest("卷调序列表必须与现有卷完全一致")
	}
	byID := make(map[shared.ID]*SeriesSection, len(s.sections))
	for _, sec := range s.sections {
		byID[sec.id] = sec
	}
	reordered := make([]*SeriesSection, 0, len(orderedIDs))
	seen := make(map[shared.ID]struct{}, len(orderedIDs))
	for _, id := range orderedIDs {
		if _, dup := seen[id]; dup {
			return shared.BadRequest("卷调序列表存在重复卷")
		}
		sec, ok := byID[id]
		if !ok {
			return shared.BadRequest("卷调序列表包含不属于本书的卷")
		}
		seen[id] = struct{}{}
		reordered = append(reordered, sec)
	}
	for i, sec := range reordered {
		sec.sortOrder = i
	}
	s.sections = reordered
	return nil
}

// HasSection 卷是否属于本书。
func (s *Series) HasSection(id shared.ID) bool {
	for _, sec := range s.sections {
		if sec.id.Equal(id) {
			return true
		}
	}
	return false
}

// 访问器
func (s *Series) ID() shared.ID        { return s.id }
func (s *Series) AuthorID() shared.ID  { return s.authorID }
func (s *Series) Title() string        { return s.title }
func (s *Series) Slug() string         { return s.slug }
func (s *Series) Description() string  { return s.description }
func (s *Series) CoverImage() string   { return s.coverImage }
func (s *Series) Status() string       { return s.status }
func (s *Series) CreatedAt() time.Time { return s.timestamps.CreatedAt }
func (s *Series) UpdatedAt() time.Time { return s.timestamps.UpdatedAt }
func (s *Series) IsPublished() bool    { return s.status == StatusPublished }

// Sections 返回卷列表（已按 sortOrder 升序维护；返回切片副本防外部改动内部状态）。
func (s *Series) Sections() []*SeriesSection {
	out := make([]*SeriesSection, len(s.sections))
	copy(out, s.sections)
	return out
}

// ============================================================
// 章节归属（posts 三列的领域视图）
// ============================================================

// Chapter 章节读模型：书页目录与导航的最小字段集（完整内容走 post 域）。
type Chapter struct {
	// PostID 章节（文章）ID
	PostID shared.ID
	// Slug 文章 slug（公开目录跳转用）
	Slug string
	// Title 文章标题
	Title string
	// Status 文章状态（published/draft/archived；公开目录仅含 published）
	Status string
	// SectionID 所属卷 ID；nil=书根章节
	SectionID *shared.ID
	// ChapterOrder 所在范围（书根或某卷）内的相对序
	ChapterOrder int
	// PublishedAt 发布时间
	PublishedAt time.Time
}

// IsPublished 章节是否对公众可见。
func (c *Chapter) IsPublished() bool { return c.Status == "published" }

// OrderedChapters 目录展示顺序：根章节在前（chapter_order 升序），
// 各卷按 sort_order 升序依次排列，卷内章节按 chapter_order 升序。
func OrderedChapters(sections []*SeriesSection, chapters []Chapter) []Chapter {
	roots := make([]Chapter, 0)
	bySection := make(map[shared.ID][]Chapter, len(sections))
	for _, ch := range chapters {
		if ch.SectionID == nil {
			roots = append(roots, ch)
		} else {
			bySection[*ch.SectionID] = append(bySection[*ch.SectionID], ch)
		}
	}
	sortChapters := func(list []Chapter) {
		for i := 1; i < len(list); i++ {
			for j := i; j > 0 && list[j].ChapterOrder < list[j-1].ChapterOrder; j-- {
				list[j], list[j-1] = list[j-1], list[j]
			}
		}
	}
	sortChapters(roots)
	out := make([]Chapter, 0, len(chapters))
	out = append(out, roots...)
	for _, sec := range sections {
		list := bySection[sec.id]
		sortChapters(list)
		out = append(out, list...)
	}
	return out
}

// 领域错误
var (
	// ErrNotFound 书不存在
	ErrNotFound = shared.NotFound("系列书")
	// ErrSectionNotFound 卷不存在
	ErrSectionNotFound = shared.NotFound("卷")
	// ErrChapterNotInSeries 章节不属于该书（摘章时）
	ErrChapterNotInSeries = shared.BadRequest("该文章不在这本书里")
)
