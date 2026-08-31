// Package gallery 定义图集视觉作品的领域模型。
package gallery

import (
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

const (
	// MaxItems 工作稿允许保存的图片数量上限。
	MaxItems = 50
	// MaxTitleRunes 标题字符上限。
	MaxTitleRunes = 120
	// MaxSummaryRunes 摘要字符上限。
	MaxSummaryRunes = 500
	// MaxCaptionRunes 单项说明字符上限。
	MaxCaptionRunes = 500
	// MaxAltOverrideRunes 单项无障碍文本覆盖字符上限。
	MaxAltOverrideRunes = 300
)

const (
	// StatusDraft 表示图集从未发布。
	StatusDraft = "draft"
	// StatusPublished 表示工作稿就是当前公开版本。
	StatusPublished = "published"
	// StatusModified 表示工作稿包含尚未公开的修改。
	StatusModified = "modified"
	// StatusUnpublished 表示图集已撤回但保留工作稿和稳定 slug。
	StatusUnpublished = "unpublished"
)

// GalleryCreated 图集工作稿已创建事件。
type GalleryCreated struct {
	shared.BaseEvent
	// AuthorID 图集作者 ID。
	AuthorID shared.ID
}

// GalleryPublished 携带公开版本切换后的稳定地址。
type GalleryPublished struct {
	shared.BaseEvent
	// Slug 图集稳定公开标识。
	Slug string
}

func NewGalleryCreated(id, authorID shared.ID) GalleryCreated {
	return GalleryCreated{BaseEvent: shared.NewBaseEvent("gallery.created", id), AuthorID: authorID}
}

func NewGalleryPublished(id shared.ID, slug string) GalleryPublished {
	return GalleryPublished{BaseEvent: shared.NewBaseEvent("gallery.published", id), Slug: slug}
}

// RevisionItem 图集工作稿中的有序图片项。
type RevisionItem struct {
	// fileID 素材库文件 ID。
	fileID shared.ID
	// position 在工作稿中的连续位置，从 0 开始。
	position int
	// caption 当前图集语境下的图片说明。
	caption string
	// altTextOverride 当前图集语境下的无障碍文本覆盖；空串表示使用素材描述。
	altTextOverride string
}

// Revision 图集的一个有效快照。
type Revision struct {
	// id revision 唯一标识。
	id shared.ID
	// galleryID 所属图集 ID。
	galleryID shared.ID
	// title 图集标题；工作稿阶段允许为空。
	title string
	// summary 图集摘要；允许为空。
	summary string
	// items 按 position 升序保存的图片项。
	items []*RevisionItem
	// createdAt revision 创建时间。
	createdAt time.Time
	// updatedAt revision 最近保存时间。
	updatedAt time.Time
}

// Gallery 图集聚合根。
type Gallery struct {
	shared.AggregateRoot

	// id 图集唯一标识。
	id shared.ID
	// authorID 作者 ID，创建后不可变。
	authorID shared.ID
	// slug 首次发布后生成的稳定公开标识；工作稿阶段为空。
	slug string
	// workingRevision 当前编辑中的工作稿快照。
	workingRevision *Revision
	// publishedRevision 当前公开快照；nil 表示未发布。
	publishedRevision *Revision
	// version 聚合乐观锁版本，从 1 开始，每次保存或发布维护加 1。
	version int64
	// publishedAt 首次发布时间；从未发布为 nil，后续维护不改变。
	publishedAt *time.Time
	// timestamps 图集创建与最近保存时间。
	timestamps shared.Timestamps
}

// DocumentItem 完整工作稿保存的单项输入。
type DocumentItem struct {
	// FileID 素材库文件 ID。
	FileID shared.ID
	// Caption 当前图集语境下的图片说明。
	Caption string
	// AltTextOverride 当前图集语境下的无障碍文本覆盖。
	AltTextOverride string
}

func NewGallery(id, authorID, revisionID shared.ID) (*Gallery, error) {
	if id.IsZero() || authorID.IsZero() || revisionID.IsZero() {
		return nil, shared.BadRequest("图集、作者与工作稿 ID 不能为空")
	}
	now := time.Now()
	g := &Gallery{
		id:       id,
		authorID: authorID,
		workingRevision: &Revision{
			id: revisionID, galleryID: id, items: make([]*RevisionItem, 0),
			createdAt: now, updatedAt: now,
		},
		version:    1,
		timestamps: shared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}
	g.RecordEvent(NewGalleryCreated(id, authorID))
	return g, nil
}

// Reconstruct 从持久化数据重建图集，不触发校验和领域事件。
func Reconstruct(id, authorID shared.ID, slug string, working, published *Revision, version int64, publishedAt *time.Time, createdAt, updatedAt time.Time) *Gallery {
	return &Gallery{
		id: id, authorID: authorID, slug: slug, workingRevision: working,
		publishedRevision: published, version: version, publishedAt: publishedAt,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// ReconstructRevision 从持久化数据重建 revision。
func ReconstructRevision(id, galleryID shared.ID, title, summary string, items []*RevisionItem, createdAt, updatedAt time.Time) *Revision {
	if items == nil {
		items = make([]*RevisionItem, 0)
	}
	return &Revision{id: id, galleryID: galleryID, title: title, summary: summary, items: items, createdAt: createdAt, updatedAt: updatedAt}
}

// ReconstructItem 从持久化数据重建 revision item。
func ReconstructItem(fileID shared.ID, position int, caption, altTextOverride string) *RevisionItem {
	return &RevisionItem{fileID: fileID, position: position, caption: caption, altTextOverride: altTextOverride}
}

func (g *Gallery) EnsureVersion(expected int64) error {
	if expected < 1 || expected != g.version {
		return ErrVersionConflict
	}
	return nil
}

// ReplaceWorkingDocument 用完整文档替换工作稿，数组顺序是唯一排序权威。
func (g *Gallery) ReplaceWorkingDocument(expected int64, title, summary string, input []DocumentItem) error {
	if err := g.EnsureVersion(expected); err != nil {
		return err
	}
	title = strings.TrimSpace(title)
	summary = strings.TrimSpace(summary)
	if utf8.RuneCountInString(title) > MaxTitleRunes {
		return shared.BadRequest("图集标题不能超过 120 个字符")
	}
	if utf8.RuneCountInString(summary) > MaxSummaryRunes {
		return shared.BadRequest("图集摘要不能超过 500 个字符")
	}
	if len(input) > MaxItems {
		return shared.BadRequest("图集最多包含 50 张图片")
	}

	items := make([]*RevisionItem, 0, len(input))
	seen := make(map[shared.ID]struct{}, len(input))
	for position, item := range input {
		if item.FileID.IsZero() {
			return shared.BadRequest("图集图片 ID 不能为空")
		}
		if _, exists := seen[item.FileID]; exists {
			return shared.BadRequest("同一素材不能在图集中重复出现")
		}
		seen[item.FileID] = struct{}{}
		caption := strings.TrimSpace(item.Caption)
		alt := strings.TrimSpace(item.AltTextOverride)
		if utf8.RuneCountInString(caption) > MaxCaptionRunes {
			return shared.BadRequest("单张图片说明不能超过 500 个字符")
		}
		if utf8.RuneCountInString(alt) > MaxAltOverrideRunes {
			return shared.BadRequest("单张图片无障碍文本不能超过 300 个字符")
		}
		items = append(items, &RevisionItem{fileID: item.FileID, position: position, caption: caption, altTextOverride: alt})
	}

	now := time.Now()
	g.workingRevision.title = title
	g.workingRevision.summary = summary
	g.workingRevision.items = items
	g.workingRevision.updatedAt = now
	g.version++
	g.timestamps.UpdatedAt = now
	return nil
}

// CloneWorkingRevision 在工作稿仍指向公开快照时创建独立副本。
func (g *Gallery) CloneWorkingRevision(id shared.ID) error {
	if id.IsZero() {
		return shared.BadRequest("新工作稿 ID 不能为空")
	}
	if !g.WorkingRevisionIsPublished() {
		return nil
	}
	items := make([]*RevisionItem, 0, len(g.workingRevision.items))
	for _, item := range g.workingRevision.items {
		items = append(items, &RevisionItem{
			fileID: item.fileID, position: item.position,
			caption: item.caption, altTextOverride: item.altTextOverride,
		})
	}
	now := time.Now()
	g.workingRevision = &Revision{
		id: id, galleryID: g.id, title: g.workingRevision.title, summary: g.workingRevision.summary,
		items: items, createdAt: now, updatedAt: now,
	}
	return nil
}

// Publish 把完整工作稿设为公开快照；首次发布后 slug 与发布时间保持不变。
func (g *Gallery) Publish(expected int64, slug string, occurredAt time.Time) error {
	if err := g.EnsureVersion(expected); err != nil {
		return err
	}
	if g.WorkingRevisionIsPublished() {
		return ErrAlreadyPublished
	}
	if strings.TrimSpace(g.workingRevision.title) == "" {
		return shared.BadRequest("发布图集前必须填写标题")
	}
	if len(g.workingRevision.items) < 2 {
		return shared.BadRequest("发布图集至少需要 2 张图片")
	}
	if occurredAt.IsZero() {
		return shared.BadRequest("图集发布时间不能为空")
	}
	if g.slug == "" {
		slug = strings.TrimSpace(slug)
		if slug == "" {
			return shared.BadRequest("图集公开标识不能为空")
		}
		g.slug = slug
	}
	g.publishedRevision = g.workingRevision
	if g.publishedAt == nil {
		g.publishedAt = &occurredAt
	}
	g.version++
	g.timestamps.UpdatedAt = occurredAt
	g.RecordEvent(NewGalleryPublished(g.id, g.slug))
	return nil
}

// Unpublish 清空公开指针，但保留工作稿、slug 与首次发布时间。
func (g *Gallery) Unpublish(expected int64, unpublishedAt time.Time) error {
	if err := g.EnsureVersion(expected); err != nil {
		return err
	}
	if g.publishedRevision == nil {
		return ErrNotPublished
	}
	if unpublishedAt.IsZero() {
		return shared.BadRequest("图集撤回时间不能为空")
	}
	g.publishedRevision = nil
	g.version++
	g.timestamps.UpdatedAt = unpublishedAt
	return nil
}

func (g *Gallery) ID() shared.ID                { return g.id }
func (g *Gallery) AuthorID() shared.ID          { return g.authorID }
func (g *Gallery) Slug() string                 { return g.slug }
func (g *Gallery) WorkingRevision() *Revision   { return g.workingRevision }
func (g *Gallery) PublishedRevision() *Revision { return g.publishedRevision }
func (g *Gallery) PublishedRevisionID() *shared.ID {
	if g.publishedRevision == nil {
		return nil
	}
	id := g.publishedRevision.id
	return &id
}
func (g *Gallery) Version() int64          { return g.version }
func (g *Gallery) PublishedAt() *time.Time { return g.publishedAt }
func (g *Gallery) CreatedAt() time.Time    { return g.timestamps.CreatedAt }
func (g *Gallery) UpdatedAt() time.Time    { return g.timestamps.UpdatedAt }
func (g *Gallery) Status() string {
	if g.publishedRevision == nil {
		if g.slug != "" {
			return StatusUnpublished
		}
		return StatusDraft
	}
	if g.WorkingRevisionIsPublished() {
		return StatusPublished
	}
	return StatusModified
}
func (g *Gallery) WorkingRevisionIsPublished() bool {
	return g.publishedRevision != nil && g.workingRevision.id.Equal(g.publishedRevision.id)
}

// FileReferenceCounts 返回所有有效快照按素材汇总的引用次数。
func (g *Gallery) FileReferenceCounts() map[shared.ID]int {
	counts := make(map[shared.ID]int)
	for _, item := range g.workingRevision.items {
		counts[item.fileID]++
	}
	if g.publishedRevision != nil && !g.publishedRevision.id.Equal(g.workingRevision.id) {
		for _, item := range g.publishedRevision.items {
			counts[item.fileID]++
		}
	}
	return counts
}

func (r *Revision) ID() shared.ID               { return r.id }
func (r *Revision) GalleryID() shared.ID        { return r.galleryID }
func (r *Revision) Title() string               { return r.title }
func (r *Revision) Summary() string             { return r.summary }
func (r *Revision) CreatedAt() time.Time        { return r.createdAt }
func (r *Revision) UpdatedAt() time.Time        { return r.updatedAt }
func (i *RevisionItem) FileID() shared.ID       { return i.fileID }
func (i *RevisionItem) Position() int           { return i.position }
func (i *RevisionItem) Caption() string         { return i.caption }
func (i *RevisionItem) AltTextOverride() string { return i.altTextOverride }

// Items 返回工作稿项切片副本。
func (r *Revision) Items() []*RevisionItem {
	out := make([]*RevisionItem, len(r.items))
	copy(out, r.items)
	return out
}
