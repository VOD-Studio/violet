// Package customemoji 定义自定义表情聚合的领域模型。
//
// 与 domain/emoji（后台管理员维护的系统表情目录）并列但独立：自定义表情由用户
// 自助上传，默认私有（仅上传者可选用），他人需通过收藏获得选用权；渲染解析
// 按 ID 而非按名称（系统表情继续按名称，两套 token 互不冲突）。
// 详见 docs/adr/0013-custom-emoji-private-favorite-model.md。
package customemoji

import (
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// CustomEmoji 自定义表情聚合根。
//
// 不可变：无 Update 方法——改名/换图需删除重传，与 Tweet「不可编辑，只可删除
// 重发」同构，保持简单。
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
