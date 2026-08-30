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

// StatusDraft 表示图集尚无公开版本。
const StatusDraft = "draft"

// GalleryCreated 图集工作稿已创建事件。
type GalleryCreated struct {
	shared.BaseEvent
	// AuthorID 图集作者 ID。
	AuthorID shared.ID
}

func NewGalleryCreated(id, authorID shared.ID) GalleryCreated {
	return GalleryCreated{BaseEvent: shared.NewBaseEvent("gallery.created", id), AuthorID: authorID}
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
	// publishedRevisionID 当前公开快照；nil 表示未发布。
	publishedRevisionID *shared.ID
	// version 工作稿乐观锁版本，从 1 开始，每次完整保存加 1。
	version int64
	// publishedAt 当前公开版本发布时间；未发布为 nil。
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
func Reconstruct(id, authorID shared.ID, slug string, working *Revision, publishedRevisionID *shared.ID, version int64, publishedAt *time.Time, createdAt, updatedAt time.Time) *Gallery {
	return &Gallery{
		id: id, authorID: authorID, slug: slug, workingRevision: working,
		publishedRevisionID: publishedRevisionID, version: version, publishedAt: publishedAt,
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

func (g *Gallery) ID() shared.ID                   { return g.id }
func (g *Gallery) AuthorID() shared.ID             { return g.authorID }
func (g *Gallery) Slug() string                    { return g.slug }
func (g *Gallery) WorkingRevision() *Revision      { return g.workingRevision }
func (g *Gallery) PublishedRevisionID() *shared.ID { return g.publishedRevisionID }
func (g *Gallery) Version() int64                  { return g.version }
func (g *Gallery) PublishedAt() *time.Time         { return g.publishedAt }
func (g *Gallery) CreatedAt() time.Time            { return g.timestamps.CreatedAt }
func (g *Gallery) UpdatedAt() time.Time            { return g.timestamps.UpdatedAt }
func (g *Gallery) Status() string                  { return StatusDraft }
func (r *Revision) ID() shared.ID                  { return r.id }
func (r *Revision) GalleryID() shared.ID           { return r.galleryID }
func (r *Revision) Title() string                  { return r.title }
func (r *Revision) Summary() string                { return r.summary }
func (r *Revision) CreatedAt() time.Time           { return r.createdAt }
func (r *Revision) UpdatedAt() time.Time           { return r.updatedAt }
func (i *RevisionItem) FileID() shared.ID          { return i.fileID }
func (i *RevisionItem) Position() int              { return i.position }
func (i *RevisionItem) Caption() string            { return i.caption }
func (i *RevisionItem) AltTextOverride() string    { return i.altTextOverride }

// Items 返回工作稿项切片副本。
func (r *Revision) Items() []*RevisionItem {
	out := make([]*RevisionItem, len(r.items))
	copy(out, r.items)
	return out
}
