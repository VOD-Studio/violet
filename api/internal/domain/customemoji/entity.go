// Package customemoji 定义用户自定义表情聚合。
package customemoji

import (
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// CustomEmoji 自定义表情聚合根。
//
// 名称与图片创建后不可变，改名或换图需删除后重新上传。
type CustomEmoji struct {
	shared.AggregateRoot
	// ownerID 上传者，创建时固定不可变。
	ownerID shared.ID
	// name 展示名，同一 ownerID 下唯一（而非全局唯一），用于 [name:id] 占位符
	// 的展示部分。跨 owner 允许重名，不做全局唯一校验。
	name string
	// url 图片 URL（/uploads/...），复用现有 upload.File 落盘路径与校验。
	url string
	// createdAt 创建时间。
	createdAt time.Time
	// deletedAt 软删除时间；自行删除与管理员强制下架走同一字段，不区分原因——
	// 级联失效（收藏者同步失效、历史内容降级占位）由读路径统一处理。
	deletedAt *time.Time
}

// NewCustomEmoji 创建自定义表情。
//
// name trim 后非空，否则返回 ErrEmptyName。同一 ownerID 下 name 唯一的校验
// 需要查库，本构造函数不做 I/O，由 application 层在调用前预检查
// （数据库唯一索引兜底并发场景）。
func NewCustomEmoji(ownerID shared.ID, name, url string, now time.Time) (*CustomEmoji, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrEmptyName
	}
	e := &CustomEmoji{ownerID: ownerID, name: name, url: url, createdAt: now}
	e.SetID(shared.NewID())
	return e, nil
}

// ReconstructCustomEmoji 从持久化数据重建自定义表情。
func ReconstructCustomEmoji(id, ownerID shared.ID, name, url string, createdAt time.Time, deletedAt *time.Time) *CustomEmoji {
	e := &CustomEmoji{ownerID: ownerID, name: name, url: url, createdAt: createdAt, deletedAt: deletedAt}
	e.SetID(id)
	return e
}

// Delete 软删除（自行删除或管理员强制下架，不区分原因）。
func (e *CustomEmoji) Delete(now time.Time) {
	e.deletedAt = &now
}

// IsUsable 是否可被选用/渲染引用（未被软删除）。
func (e *CustomEmoji) IsUsable() bool { return e.deletedAt == nil }

// ID 返回表情 ID。
func (e *CustomEmoji) ID() shared.ID { return e.GetID() }

// OwnerID 返回上传者 ID。
func (e *CustomEmoji) OwnerID() shared.ID { return e.ownerID }

// Name 返回展示名。
func (e *CustomEmoji) Name() string { return e.name }

// URL 返回图片 URL。
func (e *CustomEmoji) URL() string { return e.url }

// CreatedAt 返回创建时间。
func (e *CustomEmoji) CreatedAt() time.Time { return e.createdAt }

// DeletedAt 返回软删除时间；nil 表示仍可用。
func (e *CustomEmoji) DeletedAt() *time.Time { return e.deletedAt }

// ErrEmptyName 表情名称为空。
var ErrEmptyName = shared.Validation("表情名称不能为空")
