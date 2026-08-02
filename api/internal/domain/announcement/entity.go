// Package announcement 定义公告聚合的领域模型。
//
// 公告是简单的 CRUD 实体，业务逻辑简单（活跃区间、类型枚举、展示形态），
// 采用简化领域模型（不强制 CQRS 分离的复杂度，但保持四层架构）。
package announcement

import (
	"encoding/json"
	"time"

	"blog-api/internal/domain/shared"
)

// 严重程度枚举（DB 列名仍为 type，语义重定义为 severity）
const (
	SeverityInfo    = "info"
	SeverityWarning = "warning"
	SeveritySuccess = "success"
	SeverityError   = "error"
)

var validSeverities = map[string]bool{
	SeverityInfo: true, SeverityWarning: true, SeveritySuccess: true, SeverityError: true,
}

// IsValidSeverity 校验严重程度是否合法
func IsValidSeverity(s string) bool { return validSeverities[s] }

// 展示形态枚举
const (
	DisplayBanner  = "banner"
	DisplayCard    = "card"
	DisplayArticle = "article"
)

var validDisplays = map[string]bool{
	DisplayBanner: true, DisplayCard: true, DisplayArticle: true,
}

// IsValidDisplay 校验展示形态是否合法
func IsValidDisplay(d string) bool { return validDisplays[d] }

// Announcement 公告聚合根
type Announcement struct {
	shared.AggregateRoot

	// id 公告主键
	id int32
	// title 公告标题
	title string
	// content 纯文本内容（banner/card 形态展示；article 形态改用 contentMD/contentHTML）
	content string
	// severity 严重程度：info / warning / success / error
	//
	// DB 列名仍为 type，语义重定义为 severity。
	severity string
	// display 展示形态：banner（横幅）/ card（卡片）/ article（富文本文章）
	display string
	// isActive 是否启用（手动开关，与时间区间叠加判定是否生效，见 IsCurrentlyActive）
	isActive bool
	// startTime 生效开始时间（可空：空表示立即生效）
	startTime *time.Time
	// endTime 生效结束时间（可空：空表示永不失效）
	endTime *time.Time
	// sortOrder 排序值（越小越靠前）
	sortOrder int
	// affects 影响范围（受影响的页面/路由列表，以 JSON 数组持久化）
	affects []string
	// contentMD article 形态的 Markdown 正文
	contentMD string
	// contentHTML article 形态渲染后的 HTML（由 contentMD 预渲染，展示用）
	contentHTML string
	// coverImage article 形态的封面图 URL
	coverImage string
	// excerpt article 形态的摘要
	excerpt string
	// createdBy 创建人用户 ID（可空：系统生成无创建人）
	createdBy *shared.ID
	// timestamps 创建/更新时间戳
	timestamps shared.Timestamps
}

// NewAnnouncement 创建新公告
func NewAnnouncement(id int32, title, content, severity string) (*Announcement, error) {
	if title == "" {
		return nil, shared.BadRequest("标题不能为空")
	}
	if content == "" {
		return nil, shared.BadRequest("内容不能为空")
	}
	if !IsValidSeverity(severity) {
		return nil, shared.BadRequest("无效的公告类型")
	}
	return &Announcement{
		id: id, title: title, content: content, severity: severity,
		display: DisplayBanner, isActive: true,
	}, nil
}

// ReconstructAnnouncement 从持久化数据重建公告
func ReconstructAnnouncement(
	id int32, title, content, severity, display string, isActive bool,
	start, end *time.Time, sortOrder int, affects []string,
	contentMD, contentHTML, coverImage, excerpt string,
	createdBy *shared.ID, createdAt, updatedAt time.Time,
) *Announcement {
	return &Announcement{
		id: id, title: title, content: content, severity: severity, display: display,
		isActive: isActive, startTime: start, endTime: end, sortOrder: sortOrder,
		affects: affects, contentMD: contentMD, contentHTML: contentHTML,
		coverImage: coverImage, excerpt: excerpt, createdBy: createdBy,
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

// SetDisplay 设置展示形态
func (a *Announcement) SetDisplay(display string) error {
	if !IsValidDisplay(display) {
		return shared.BadRequest("无效的展示形态")
	}
	a.display = display
	return nil
}

// SetSortOrder 设置排序值
func (a *Announcement) SetSortOrder(order int) { a.sortOrder = order }

// SetAffects 设置影响范围（JSON 数组源字符串由调用方解析为 []string 传入）
func (a *Announcement) SetAffects(affects []string) { a.affects = affects }

// SetRichContent 设置富文本内容（article 形态）
func (a *Announcement) SetRichContent(md, html, cover, excerpt string) {
	a.contentMD = md
	a.contentHTML = html
	a.coverImage = cover
	a.excerpt = excerpt
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

// Update 更新标题、内容、严重程度
func (a *Announcement) Update(title, content, severity string) error {
	if title == "" {
		return shared.BadRequest("标题不能为空")
	}
	if content == "" {
		return nil
	}
	if severity != "" && !IsValidSeverity(severity) {
		return shared.BadRequest("无效的公告类型")
	}
	a.title = title
	if content != "" {
		a.content = content
	}
	if severity != "" {
		a.severity = severity
	}
	return nil
}

// 访问器
func (a *Announcement) ID() int32             { return a.id }
func (a *Announcement) Title() string         { return a.title }
func (a *Announcement) Content() string       { return a.content }
func (a *Announcement) Severity() string      { return a.severity }
func (a *Announcement) Display() string       { return a.display }
func (a *Announcement) IsActive() bool        { return a.isActive }
func (a *Announcement) StartTime() *time.Time { return a.startTime }
func (a *Announcement) EndTime() *time.Time   { return a.endTime }
func (a *Announcement) SortOrder() int        { return a.sortOrder }
func (a *Announcement) Affects() []string     { return a.affects }
func (a *Announcement) ContentMD() string     { return a.contentMD }
func (a *Announcement) ContentHTML() string   { return a.contentHTML }
func (a *Announcement) CoverImage() string    { return a.coverImage }
func (a *Announcement) Excerpt() string       { return a.excerpt }
func (a *Announcement) CreatedBy() *shared.ID { return a.createdBy }
func (a *Announcement) CreatedAt() time.Time  { return a.timestamps.CreatedAt }
func (a *Announcement) UpdatedAt() time.Time  { return a.timestamps.UpdatedAt }

// AffectsJSON 将 affects 序列化为 JSON 字符串（持久化用）
func (a *Announcement) AffectsJSON() string {
	if len(a.affects) == 0 {
		return ""
	}
	b, _ := json.Marshal(a.affects)
	return string(b)
}

// ParseAffects 把 DB 的 JSON 字符串解析为 []string
func ParseAffects(raw string) []string {
	if raw == "" {
		return nil
	}
	var arr []string
	if err := json.Unmarshal([]byte(raw), &arr); err != nil {
		return nil
	}
	return arr
}
