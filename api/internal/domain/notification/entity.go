// Package notification 定义通知聚合根与领域端口。
//
// 通知是 EventBus 的第二个消费者（与审计 subscriber 平行）：领域事件发生 →
// 通知 subscriber 计算接收者 → 给每个接收者写一行通知 → SSE 实时推送。
// 通知是写时扇出（fan-out-on-write）的领域模型，每个接收者一行。
package notification

import (
	"fmt"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// SourceType 通知来源类型（受控枚举）。
//
// 扩展新类型时：加常量 + subscriber 映射 + 扩展 DB CHECK 约束迁移。
// 不用自由字符串——字段名拼写错误运行时才暴露，受控枚举换来编译期安全 + 可筛选。
type SourceType string

const (
	// SourceSubscriptionFailed 订阅抓取失败
	SourceSubscriptionFailed SourceType = "subscription_failed"
	// SourceSubscriptionSucceeded 订阅手动抓取成功
	SourceSubscriptionSucceeded SourceType = "subscription_succeeded"
	// SourceFriendLinkApplied 友链申请
	SourceFriendLinkApplied SourceType = "friendlink_applied"
	// SourceFriendLinkReviewed 友链审核结果（通知登录申请者）
	SourceFriendLinkReviewed SourceType = "friendlink_reviewed"
	// SourceCommentApproved 评论审核通过（通知评论作者）
	SourceCommentApproved SourceType = "comment_approved"
	// SourceCommentCreated 文章收到新评论（通知文章作者）
	SourceCommentCreated SourceType = "comment_created"
	// SourceCommentRejected 评论未通过审核（通知评论作者）
	SourceCommentRejected SourceType = "comment_rejected"
	// SourceUserRegistered 新用户注册（通知管理员）
	SourceUserRegistered SourceType = "user_registered"
	// SourceAccountSecurity 账号安全提醒：改密 / API token 增删 / 角色与状态变更（通知本人）
	SourceAccountSecurity SourceType = "account_security"
)

// validSourceTypes 合法来源类型集合，供校验与 DB CHECK 同步参照。
var validSourceTypes = map[SourceType]bool{
	SourceSubscriptionFailed:    true,
	SourceSubscriptionSucceeded: true,
	SourceFriendLinkApplied:     true,
	SourceFriendLinkReviewed:    true,
	SourceCommentApproved:       true,
	SourceCommentCreated:        true,
	SourceCommentRejected:       true,
	SourceUserRegistered:        true,
	SourceAccountSecurity:       true,
}

// IsValidSourceType 判断来源类型是否合法。
func IsValidSourceType(s SourceType) bool { return validSourceTypes[s] }

// ErrInvalidSourceType 非法来源类型
var ErrInvalidSourceType = domainshared.BadRequest("非法通知来源类型")

// ErrAlreadyRead 通知已读不可回退为未读
var ErrAlreadyRead = domainshared.BadRequest("通知已读，不可回退为未读")

// Notification 通知聚合根。
//
// 不变量：
//   - userID 创建后不可变（通知归属固定）
//   - sourceType 必须是受控枚举值
//   - readAt 一旦设置不可回退（nil→time，不可 time→nil）
type Notification struct {
	domainshared.AggregateRoot
	// userID 接收者（通知归属，创建后不可变）
	userID domainshared.ID
	// eventID 触发此通知的领域事件 ID（幂等键：UNIQUE(event_id, user_id) 防重复写入）
	eventID domainshared.ID
	// sourceType 通知来源类型（渲染分支 + 筛选，受控枚举）
	sourceType SourceType
	// sourceID 关联资源 ID（如 comment_id / subscription_id / friendlink_id）
	sourceID domainshared.ID
	// title 通知标题快照（subscriber 写入时生成，不实时查关联资源）
	title string
	// body 通知正文摘要快照（同 title，写入时确定）
	body string
	// payload 类型特有字段（JSONB 存储扩展字段，如 error_summary / post_title）
	payload map[string]any
	// readAt 已读时间戳；nil = 未读，设置后不可回退
	readAt *time.Time
	// timestamps 创建时间（通知无更新——写入后不可变，只有 readAt 变更）
	domainshared.Timestamps
}

// NewNotification 创建新通知。
//
// title/body 是写入时快照（subscriber 生成），不实时查关联资源——
func NewNotification(
	userID, eventID domainshared.ID,
	sourceType SourceType,
	sourceID domainshared.ID,
	title, body string,
	payload map[string]any,
) (*Notification, error) {
	if userID.IsZero() {
		return nil, domainshared.BadRequest("接收者不能为空")
	}
	if eventID.IsZero() {
		return nil, domainshared.BadRequest("触发事件不能为空")
	}
	if !IsValidSourceType(sourceType) {
		return nil, ErrInvalidSourceType
	}
	if sourceID.IsZero() {
		return nil, domainshared.BadRequest("关联资源不能为空")
	}
	if title == "" {
		return nil, domainshared.BadRequest("通知标题不能为空")
	}
	now := time.Now()
	return &Notification{
		userID:     userID,
		eventID:    eventID,
		sourceType: sourceType,
		sourceID:   sourceID,
		title:      title,
		body:       body,
		payload:    payload,
		Timestamps: domainshared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}, nil
}

// Reconstruct 从持久化数据重建（无校验、无副作用、无默认值填充）。
func Reconstruct(
	id, userID, eventID domainshared.ID,
	sourceType SourceType,
	sourceID domainshared.ID,
	title, body string,
	payload map[string]any,
	readAt *time.Time,
	createdAt time.Time,
) *Notification {
	n := &Notification{
		userID:     userID,
		eventID:    eventID,
		sourceType: sourceType,
		sourceID:   sourceID,
		title:      title,
		body:       body,
		payload:    payload,
		readAt:     readAt,
	}
	n.SetID(id)
	n.Timestamps = domainshared.Timestamps{CreatedAt: createdAt, UpdatedAt: createdAt}
	return n
}

// MarkAsRead 标记已读。已读不可回退——二次调用返回 ErrAlreadyRead。
func (n *Notification) MarkAsRead(now time.Time) error {
	if n.readAt != nil {
		return ErrAlreadyRead
	}
	n.readAt = &now
	return nil
}

// IsRead 是否已读
func (n *Notification) IsRead() bool { return n.readAt != nil }

// --- 访问器 ---

func (n *Notification) UserID() domainshared.ID     { return n.userID }
func (n *Notification) EventID() domainshared.ID    { return n.eventID }
func (n *Notification) SourceType() SourceType      { return n.sourceType }
func (n *Notification) SourceID() domainshared.ID   { return n.sourceID }
func (n *Notification) Title() string               { return n.title }
func (n *Notification) Body() string                { return n.body }
func (n *Notification) Payload() map[string]any     { return n.payload }
func (n *Notification) ReadAt() *time.Time          { return n.readAt }
func (n *Notification) CreatedAt() time.Time        { return n.Timestamps.CreatedAt }

// String 仅供调试用
func (n *Notification) String() string {
	return fmt.Sprintf("Notification{id=%s, userID=%s, sourceType=%s, title=%q}", n.GetID(), n.userID, n.sourceType, n.title)
}
