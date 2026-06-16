// Package announcement 定义公告聚合的领域模型。
//
// 公告是简单的 CRUD 实体，业务逻辑简单（活跃区间、类型枚举），
// 采用简化领域模型（不强制 CQRS 分离的复杂度，但保持四层架构）。
package announcement

import (
	"regexp"
	"time"

	"blog-api/internal/domain/shared"
)

// 公告类型枚举
const (
	TypeInfo    = "info"
	TypeWarning = "warning"
	TypeSuccess = "success"
	TypeError   = "error"
)

var validTypes = map[string]bool{TypeInfo: true, TypeWarning: true, TypeSuccess: true, TypeError: true}

// IsValidType 校验公告类型是否合法
func IsValidType(t string) bool { return validTypes[t] }

// Announcement 公告聚合根
type Announcement struct {
	shared.AggregateRoot

	id         int32
	title      string
	content    string
	typ        string
	isActive   bool
	startTime  *time.Time
	endTime    *time.Time
	createdBy  *shared.ID
	timestamps shared.Timestamps
}

// NewAnnouncement 创建新公告
func NewAnnouncement(id int32, title, content, typ string) (*Announcement, error) {
	if title == "" {
		return nil, shared.BadRequest("标题不能为空")
	}
	if content == "" {
		return nil, shared.BadRequest("内容不能为空")
	}
	if !IsValidType(typ) {
		return nil, shared.BadRequest("无效的公告类型")
	}
	return &Announcement{
		id: id, title: title, content: content, typ: typ, isActive: true,
	}, nil
}

// ReconstructAnnouncement 从持久化数据重建公告
func ReconstructAnnouncement(id int32, title, content, typ string, isActive bool, start, end *time.Time, createdBy *shared.ID, createdAt, updatedAt time.Time) *Announcement {
	return &Announcement{
		id: id, title: title, content: content, typ: typ, isActive: isActive,
		startTime: start, endTime: end, createdBy: createdBy,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetActive 设置活跃状态
func (a *Announcement) SetActive(active bool) { a.isActive = active }

// SetTimeRange 设置生效时间区间
func (a *Announcement) SetTimeRange(start, end *time.Time) error {
	if start != nil && end != nil && start.After(*end) {
		return shared.BadRequest("开始时间不能晚于结束时间")
	}
	a.startTime = start
	a.endTime = end
	return nil
}

// IsCurrentlyActive 当前是否生效（考虑时间区间）
func (a *Announcement) IsCurrentlyActive(now time.Time) bool {
	if !a.isActive {
		return false
	}
	if a.startTime != nil && now.Before(*a.startTime) {
		return false
	}
	if a.endTime != nil && now.After(*a.endTime) {
		return false
	}
	return true
}

// Update 更新标题、内容、类型
func (a *Announcement) Update(title, content, typ string) error {
	if title == "" {
		return shared.BadRequest("标题不能为空")
	}
	if content == "" {
		return nil
	}
	if typ != "" && !IsValidType(typ) {
		return shared.BadRequest("无效的公告类型")
	}
	a.title = title
	if content != "" {
		a.content = content
	}
	if typ != "" {
		a.typ = typ
	}
	return nil
}

// 访问器
func (a *Announcement) ID() int32             { return a.id }
func (a *Announcement) Title() string         { return a.title }
func (a *Announcement) Content() string       { return a.content }
func (a *Announcement) Type() string          { return a.typ }
func (a *Announcement) IsActive() bool        { return a.isActive }
func (a *Announcement) StartTime() *time.Time { return a.startTime }
func (a *Announcement) EndTime() *time.Time   { return a.endTime }
func (a *Announcement) CreatedBy() *shared.ID { return a.createdBy }
func (a *Announcement) CreatedAt() time.Time  { return a.timestamps.CreatedAt }
func (a *Announcement) UpdatedAt() time.Time  { return a.timestamps.UpdatedAt }

// 校验 title 格式（防止注入）
var titlePattern = regexp.MustCompile(`^.{1,255}$`)
