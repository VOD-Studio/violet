// Package gallery 定义图集聚合的领域模型（PRD-0022）。
//
// 图集是 UGC 多图内容单元：title + description + 有序媒体列表（图片 / mp4 / webm）。
// 与 tweet 的差异是内容形态决定的：合集类内容的常态是持续整理，故有完整编辑路径。
// 三条领域规则：
//   - 即发即出：无先审后发状态机，创建即对公众可见
//   - 可编辑：Update 改字段、SetItems 全量替换（拖拽调序天然对应全量提交）
//   - 双轨删除：作者物理删（应用层解绑媒体引用计数）；管理员下架是软删（status=removed）
package gallery

import (
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 状态枚举
const (
	StatusPublished = "published"
	// StatusRemoved 管理员下架（软删）：前台不可见，记录保留供治理追溯
	StatusRemoved = "removed"
)

// IsValidStatus 校验状态合法性
func IsValidStatus(s string) bool {
	return s == StatusPublished || s == StatusRemoved
}

// 内容不变量上限（rune 计，中文按 1 字）
const (
	TitleMaxRunes       = 100
	DescriptionMaxRunes = 2000
	CaptionMaxRunes     = 200
	// ItemsMax 单图集媒体项上限（防滥用 + 详情页渲染体量兜底）
	ItemsMax = 50
	// ItemsMin 图集至少是「一组图」，空合集没有公开价值
	ItemsMin = 1
)

// ============================================================
// 领域事件（订阅者：审计服务）
//
// 聚合根用 UUID 主键（创建时已知），全部事件在聚合根内 RecordEvent，
// 应用层 PullEvents 后发布。GalleryDeleted 例外：删除后聚合不存在，
// 由应用层手动构造发布。
// ============================================================

// GalleryCreated 图集已创建事件
type GalleryCreated struct {
	shared.BaseEvent
	// Title 标题快照（审计可读标识）
	Title string
	// ItemCount 媒体项数快照
	ItemCount int
}

// NewGalleryCreated 构造图集创建事件
func NewGalleryCreated(id shared.ID, title string, itemCount int) GalleryCreated {
	return GalleryCreated{
		BaseEvent: shared.NewBaseEvent("gallery.created", id),
		Title:     title,
		ItemCount: itemCount,
	}
}

// GalleryChange 图集单字段变更（before/after）
type GalleryChange struct {
	Field string
	From  string
	To    string
}

// GalleryUpdated 图集已更新事件（字段 diff；items 变更记计数而非全量内容）
type GalleryUpdated struct {
	shared.BaseEvent
	// Title 标题快照
	Title string
	// Changes 变更字段列表（before/after）
	Changes []GalleryChange
}

// NewGalleryUpdated 构造图集更新事件
func NewGalleryUpdated(id shared.ID, title string, changes []GalleryChange) GalleryUpdated {
	return GalleryUpdated{
		BaseEvent: shared.NewBaseEvent("gallery.updated", id),
		Title:     title,
		Changes:   changes,
	}
}

// GalleryRemoved 图集已下架事件（published → removed，治理动作）
type GalleryRemoved struct {
	shared.BaseEvent
	// Title 标题快照
	Title string
}

// NewGalleryRemoved 构造图集下架事件
func NewGalleryRemoved(id shared.ID, title string) GalleryRemoved {
	return GalleryRemoved{
		BaseEvent: shared.NewBaseEvent("gallery.removed", id),
		Title:     title,
	}
}

// GalleryRestored 图集已恢复事件（removed → published）
type GalleryRestored struct {
	shared.BaseEvent
	// Title 标题快照
	Title string
}

// NewGalleryRestored 构造图集恢复事件
func NewGalleryRestored(id shared.ID, title string) GalleryRestored {
	return GalleryRestored{
		BaseEvent: shared.NewBaseEvent("gallery.restored", id),
		Title:     title,
	}
}

// GalleryDeleted 图集已删除事件。
//
// 物理删除后聚合根不可继续存在，事件由应用层手动构造发布。
// OwnerID 记录原作者（管理员删他人图集时与操作者不同），供审计追溯。
type GalleryDeleted struct {
	shared.BaseEvent
	// Title 标题快照
	Title string
	// OwnerID 原作者（与删除操作者可能不同）
	OwnerID shared.ID
}

// NewGalleryDeleted 构造图集删除事件
func NewGalleryDeleted(g *Gallery) GalleryDeleted {
	return GalleryDeleted{
		BaseEvent: shared.NewBaseEvent("gallery.deleted", g.id),
		Title:     g.title,
		OwnerID:   g.ownerID,
	}
}

// ============================================================
// 聚合根
// ============================================================

// GalleryItem 图集媒体项（聚合内值对象，无独立生命周期）。
//
// 顺序由 Gallery.items 切片位置承载，落库时写 position 列。
type GalleryItem struct {
	// fileID 引用 upload.File（不拷贝 URL，引用计数防误删）
	fileID shared.ID
	// caption 图片说明（≤200 rune，可空）
	caption string
}

// NewGalleryItem 构造媒体项
func NewGalleryItem(fileID shared.ID, caption string) GalleryItem {
	return GalleryItem{fileID: fileID, caption: strings.TrimSpace(caption)}
}

// ReconstructGalleryItem 从持久化数据重建（无校验）
func ReconstructGalleryItem(fileID shared.ID, caption string) GalleryItem {
	return GalleryItem{fileID: fileID, caption: caption}
}

// FileID 返回引用文件 ID
func (i GalleryItem) FileID() shared.ID { return i.fileID }

// Caption 返回图片说明
func (i GalleryItem) Caption() string { return i.caption }

// Gallery 图集聚合根。
//
// 不变量：
//   - title trim 后非空且 ≤100 rune；description ≤2000 rune；item caption ≤200 rune
//   - items 数量 1..50，顺序即展示顺序
//   - ownerID 创建时固定，无 setter（无变更路径）
//   - status 只能是 published / removed；removed 态不可编辑字段（先恢复再改）
type Gallery struct {
	shared.AggregateRoot
	id          shared.ID
	ownerID     shared.ID
	title       string
	description string
	coverFileID *shared.ID // nil = 取首项媒体当封面
	status      string
	items       []GalleryItem
	timestamps  shared.Timestamps
}

// NewGallery 创建新图集（初始态 published，即发即出）。
//
// items 为有序媒体列表（位置即展示顺序）。创建成功记录 GalleryCreated 事件。
func NewGallery(id, ownerID shared.ID, title, description string, coverFileID *shared.ID, items []GalleryItem) (*Gallery, error) {
	if err := validateFields(title, description); err != nil {
		return nil, err
	}
	if err := validateItems(items); err != nil {
		return nil, err
	}
	g := &Gallery{
		id:          id,
		ownerID:     ownerID,
		title:       strings.TrimSpace(title),
		description: strings.TrimSpace(description),
		coverFileID: coverFileID,
		status:      StatusPublished,
		items:       items,
		timestamps:  shared.Timestamps{CreatedAt: time.Now(), UpdatedAt: time.Now()},
	}
	g.RecordEvent(NewGalleryCreated(id, g.title, len(items)))
	return g, nil
}

// ReconstructGallery 从持久化数据重建图集（无校验、无副作用、不记录事件）。
//
// items 须已按 position 升序传入。
func ReconstructGallery(
	id, ownerID shared.ID,
	title, description string,
	coverFileID *shared.ID,
	status string,
	items []GalleryItem,
	createdAt, updatedAt time.Time,
) *Gallery {
	return &Gallery{
		id:          id,
		ownerID:     ownerID,
		title:       title,
		description: description,
		coverFileID: coverFileID,
		status:      status,
		items:       items,
		timestamps:  shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// validateFields 构造与更新共用的字段校验。
func validateFields(title, description string) error {
	if strings.TrimSpace(title) == "" {
		return ErrTitleRequired
	}
	if utf8.RuneCountInString(strings.TrimSpace(title)) > TitleMaxRunes {
		return ErrTitleTooLong
	}
	if utf8.RuneCountInString(description) > DescriptionMaxRunes {
		return ErrDescriptionTooLong
	}
	return nil
}

// validateItems 校验媒体项数量与各项 caption 长度。
func validateItems(items []GalleryItem) error {
	if len(items) < ItemsMin {
		return ErrItemsRequired
	}
	if len(items) > ItemsMax {
		return ErrItemsTooMany
	}
	for _, it := range items {
		if utf8.RuneCountInString(it.caption) > CaptionMaxRunes {
			return ErrCaptionTooLong
		}
	}
	return nil
}

// ============================================================
// 字段编辑（removed 态不可编辑：先恢复再改，防止治理期间内容漂移）
// ============================================================

// UpdateParams Update 的入参。
type UpdateParams struct {
	Title       string
	Description string
	// CoverFileID 封面引用；nil = 不修改（三态由调用方组装：保留/更换/清空
	// 由应用层在入参装配时决定，聚合只接受最终值）
	CoverFileID *shared.ID
	// ClearCover 显式清空封面（回退为首项媒体）
	ClearCover bool
}

// Update 编辑图集字段（title/description/cover）。
//
// 仅实际变更时记录 GalleryUpdated 事件（同值直接返回，避免幂等调用产生噪音事件）。
func (g *Gallery) Update(p UpdateParams) error {
	if g.status == StatusRemoved {
		return ErrRemovedReadOnly
	}
	if err := validateFields(p.Title, p.Description); err != nil {
		return err
	}
	title := strings.TrimSpace(p.Title)
	description := strings.TrimSpace(p.Description)
	var changes []GalleryChange
	if title != g.title {
		changes = append(changes, GalleryChange{Field: "title", From: g.title, To: title})
	}
	if description != g.description {
		changes = append(changes, GalleryChange{Field: "description", From: g.description, To: description})
	}
	var newCover *shared.ID
	switch {
	case p.ClearCover:
		newCover = nil
	case p.CoverFileID != nil:
		newCover = p.CoverFileID
	default:
		newCover = g.coverFileID
	}
	if !sameIDPtr(newCover, g.coverFileID) {
		changes = append(changes, GalleryChange{Field: "cover_file_id", From: idPtrStr(g.coverFileID), To: idPtrStr(newCover)})
	}
	if len(changes) == 0 {
		return nil
	}
	g.title = title
	g.description = description
	g.coverFileID = newCover
	g.timestamps.UpdatedAt = time.Now()
	g.RecordEvent(NewGalleryUpdated(g.id, g.title, changes))
	return nil
}

// SetItems 全量替换媒体项（增删/调序/改 caption 一次完成）。
//
// 调用方负责保证每个 fileID 归属 owner 且类型可入图集（GalleryMediaChecker 端口）。
// 事件记 item 数 before/after，不记全量内容（媒体列表可能很长）。
func (g *Gallery) SetItems(items []GalleryItem) error {
	if g.status == StatusRemoved {
		return ErrRemovedReadOnly
	}
	if err := validateItems(items); err != nil {
		return err
	}
	if itemsEqual(g.items, items) {
		return nil
	}
	changes := []GalleryChange{{
		Field: "items",
		From:  countStr(len(g.items)),
		To:    countStr(len(items)),
	}}
	g.items = items
	g.timestamps.UpdatedAt = time.Now()
	g.RecordEvent(NewGalleryUpdated(g.id, g.title, changes))
	return nil
}

// ============================================================
// 治理状态转换（published ↔ removed；仅管理员可达，权限在应用层判定）
// ============================================================

// Remove 下架图集（published → removed，前台不可见）。
func (g *Gallery) Remove() error {
	if g.status == StatusRemoved {
		return ErrAlreadyRemoved
	}
	g.status = StatusRemoved
	g.timestamps.UpdatedAt = time.Now()
	g.RecordEvent(NewGalleryRemoved(g.id, g.title))
	return nil
}

// Restore 恢复图集（removed → published）。
func (g *Gallery) Restore() error {
	if g.status != StatusRemoved {
		return ErrNotRemoved
	}
	g.status = StatusPublished
	g.timestamps.UpdatedAt = time.Now()
	g.RecordEvent(NewGalleryRestored(g.id, g.title))
	return nil
}

// ============================================================
// 访问器
// ============================================================

// ID 返回图集 ID
func (g *Gallery) ID() shared.ID { return g.id }

// OwnerID 返回创建者 ID（固定不可变）
func (g *Gallery) OwnerID() shared.ID { return g.ownerID }

// Title 返回标题
func (g *Gallery) Title() string { return g.title }

// Description 返回描述
func (g *Gallery) Description() string { return g.description }

// CoverFileID 返回封面文件 ID；nil = 取首项媒体当封面
func (g *Gallery) CoverFileID() *shared.ID { return g.coverFileID }

// Status 返回状态
func (g *Gallery) Status() string { return g.status }

// IsPublished 是否对公众可见
func (g *Gallery) IsPublished() bool { return g.status == StatusPublished }

// IsRemoved 是否已被管理员下架
func (g *Gallery) IsRemoved() bool { return g.status == StatusRemoved }

// CreatedAt 返回创建时间
func (g *Gallery) CreatedAt() time.Time { return g.timestamps.CreatedAt }

// UpdatedAt 返回更新时间
func (g *Gallery) UpdatedAt() time.Time { return g.timestamps.UpdatedAt }

// Items 返回媒体项列表（已按展示顺序维护；返回切片副本防外部改动内部状态）。
func (g *Gallery) Items() []GalleryItem {
	out := make([]GalleryItem, len(g.items))
	copy(out, g.items)
	return out
}

// ============================================================
// 内部辅助
// ============================================================

// itemsEqual 逐项比对媒体项（fileID + caption 全同视为未变更）。
func itemsEqual(a, b []GalleryItem) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].fileID != b[i].fileID || a[i].caption != b[i].caption {
			return false
		}
	}
	return true
}

// sameIDPtr 比较两个可空 ID 是否同值（皆 nil 或指向同一 ID）。
func sameIDPtr(a, b *shared.ID) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// idPtrStr 可空 ID 的字符串形态（事件 diff 用；nil → 空串）。
func idPtrStr(id *shared.ID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

// countStr item 数量的字符串形态（事件 diff 用）。
func countStr(n int) string {
	return strconv.Itoa(n)
}

// 领域错误
var (
	ErrGalleryNotFound     = shared.NotFound("图集")
	ErrTitleRequired       = shared.BadRequest("标题不能为空")
	ErrTitleTooLong        = shared.BadRequest("标题不能超过 100 字")
	ErrDescriptionTooLong  = shared.BadRequest("描述不能超过 2000 字")
	ErrCaptionTooLong      = shared.BadRequest("图片说明不能超过 200 字")
	ErrItemsRequired       = shared.BadRequest("图集至少需要 1 项媒体")
	ErrItemsTooMany        = shared.BadRequest("图集最多 50 项媒体")
	ErrRemovedReadOnly     = shared.Conflict("图集已被下架，恢复后才能编辑")
	ErrAlreadyRemoved      = shared.Conflict("图集已处于下架状态")
	ErrNotRemoved          = shared.Conflict("图集未处于下架状态")
	ErrInvalidGalleryIDFmt = shared.BadRequest("非法的图集 ID")
)
