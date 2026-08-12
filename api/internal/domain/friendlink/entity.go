// Package friendlink 定义友链聚合的领域模型。
//
// 友链是站点级内容单元（无 author 归属）：访客申请 → 站长审核 → 前台展示。
// 认证模型（PRD-0014 双轨制，镜像评论域）：
//   - 匿名申请：UserID 为 nil，ContactEmail 手填（邮箱验证码两步流在 application 层校验）
//   - 登录申请：UserID 非空，ContactEmail 由 handler 从 user 资料覆盖（防伪造）
//   - 手动添加：NewManual 构造路径，直接 approved，无 UserID/IPHash
//
// 状态机（四态，单字段 status）：
//   - pending   待审核：申请提交后的初始态
//   - approved  展示中：唯一前台展示态
//   - rejected  已拒绝：保留记录；不阻塞同一 URL 重新申请（DB 部分唯一索引）
//   - disabled  已下柜：曾 approved 被暂时撤下，可恢复
//
// 转换：pending → approved | rejected；approved ↔ disabled；rejected → approved（改判）；
// 任意态可物理删除（追溯靠审计事件，不留尸）。
package friendlink

import (
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"blog-api/internal/domain/shared"
)

// 状态枚举
const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRejected = "rejected"
	StatusDisabled = "disabled"
)

// 字段长度上限（rune 计，中文按 1 字）
const (
	maxNameLen        = 30
	maxDescriptionLen = 80
)

// IsValidStatus 校验状态合法性
func IsValidStatus(s string) bool {
	switch s {
	case StatusPending, StatusApproved, StatusRejected, StatusDisabled:
		return true
	}
	return false
}

// ============================================================
// 领域事件（订阅者：审计服务）
//
// 聚合根用 UUID 主键（创建时已知），无自增 ID 回填问题，
// 全部事件（含 created）在聚合根内 RecordEvent，应用层 PullEvents 后发布。
// ============================================================

// FriendLinkCreated 友链已创建事件（申请提交或站长手动添加）
type FriendLinkCreated struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
	// URL 站点 URL 快照
	URL string
}

// NewFriendLinkCreated 构造友链创建事件
func NewFriendLinkCreated(id shared.ID, name, siteURL string) FriendLinkCreated {
	return FriendLinkCreated{
		BaseEvent: shared.NewBaseEvent("friendlink.created", id),
		Name:      name,
		URL:       siteURL,
	}
}

// FriendLinkApproved 友链已批准事件（pending/rejected → approved）
type FriendLinkApproved struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
	// From 原状态
	From string
	// To 目标状态（恒 approved）
	To   string
}

// NewFriendLinkApproved 构造批准事件
func NewFriendLinkApproved(id shared.ID, name, from string) FriendLinkApproved {
	return FriendLinkApproved{
		BaseEvent: shared.NewBaseEvent("friendlink.approved", id),
		Name:      name,
		From:      from,
		To:        StatusApproved,
	}
}

// FriendLinkRejected 友链已拒绝事件（pending → rejected）
type FriendLinkRejected struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
	// From 原状态
	From string
	// To 目标状态（恒 rejected）
	To   string
}

// NewFriendLinkRejected 构造拒绝事件
func NewFriendLinkRejected(id shared.ID, name, from string) FriendLinkRejected {
	return FriendLinkRejected{
		BaseEvent: shared.NewBaseEvent("friendlink.rejected", id),
		Name:      name,
		From:      from,
		To:        StatusRejected,
	}
}

// FriendLinkDisabled 友链已下柜事件（approved → disabled）
type FriendLinkDisabled struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
	// From 原状态
	From string
	// To 目标状态（恒 disabled）
	To   string
}

// NewFriendLinkDisabled 构造下柜事件
func NewFriendLinkDisabled(id shared.ID, name, from string) FriendLinkDisabled {
	return FriendLinkDisabled{
		BaseEvent: shared.NewBaseEvent("friendlink.disabled", id),
		Name:      name,
		From:      from,
		To:        StatusDisabled,
	}
}

// FriendLinkRestored 友链已恢复事件（disabled → approved）
type FriendLinkRestored struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
	// From 原状态
	From string
	// To 目标状态（恒 approved）
	To   string
}

// NewFriendLinkRestored 构造恢复事件
func NewFriendLinkRestored(id shared.ID, name, from string) FriendLinkRestored {
	return FriendLinkRestored{
		BaseEvent: shared.NewBaseEvent("friendlink.restored", id),
		Name:      name,
		From:      from,
		To:        StatusApproved,
	}
}

// FriendLinkChange 友链单字段变更（before/after）
type FriendLinkChange struct {
	// Field 字段名
	Field string
	// From 变更前值
	From  string
	// To 变更后值
	To    string
}

// FriendLinkUpdated 友链已更新事件（后台编辑字段/排序）
type FriendLinkUpdated struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name    string
	// Changes 本次实际发生变化的字段集合（同值编辑不产生事件）
	Changes []FriendLinkChange
}

// NewFriendLinkUpdated 构造更新事件
func NewFriendLinkUpdated(id shared.ID, name string, changes []FriendLinkChange) FriendLinkUpdated {
	return FriendLinkUpdated{
		BaseEvent: shared.NewBaseEvent("friendlink.updated", id),
		Name:      name,
		Changes:   changes,
	}
}

// FriendLinkDeleted 友链已删除事件。
//
// 物理删除后聚合根不可继续存在，事件由应用层手动构造发布（同 announcement/comment 先例）。
type FriendLinkDeleted struct {
	shared.BaseEvent
	// Name 站点名称快照（审计可读标识）
	Name string
}

// NewFriendLinkDeleted 构造删除事件
func NewFriendLinkDeleted(id shared.ID, name string) FriendLinkDeleted {
	return FriendLinkDeleted{
		BaseEvent: shared.NewBaseEvent("friendlink.deleted", id),
		Name:      name,
	}
}

// ============================================================
// 聚合根
// ============================================================

// FriendLink 友链聚合根
type FriendLink struct {
	shared.AggregateRoot

	// id 友链 ID
	id shared.ID
	// name 站点名称（必填，≤30 rune）
	name string
	// url 站点 URL（必填，http/https）
	url string
	// avatarURL 头像 URL（可空，空则前端首字母占位）
	avatarURL string
	// description 一句话描述（可空，≤80 rune）
	description string
	// ownerName 站长称呼（可空，展示用）
	ownerName string
	// linkbackURL 回链页地址（可空，审核参考）
	linkbackURL string
	// contactEmail 联系邮箱（申请必填，仅留存不公开；手动添加可空）
	contactEmail string
	// userID 登录申请者 id（可空，双轨制；nil 表示匿名申请）
	userID *shared.ID
	// status 四态状态机
	status string
	// sortOrder 排序值（越小越靠前）
	sortOrder int
	// ipHash 申请 IP 的 SHA256（配额与反垃圾元数据）
	ipHash string
	// timestamps 创建/更新时间戳
	timestamps shared.Timestamps
}

// CreateParams NewFriendLink 的入参（申请流构造）。
type CreateParams struct {
	// ID 新友链的唯一 id（由调用方生成）
	ID shared.ID
	// UserID 登录申请者 id；nil 表示匿名（双轨认证）
	UserID *shared.ID

	Name        string
	URL         string
	AvatarURL   string // 可空
	Description string // 可空
	OwnerName   string // 可空
	LinkbackURL string // 可空
	// ContactEmail 联系邮箱（申请必填：匿名手填，登录 handler 从 user 资料覆盖）。
	// 原始输入，内部归一化（小写 + trim），保证配额 key 稳定。
	ContactEmail string
	// IPHash 申请 IP 的 SHA256（handler 计算填充）
	IPHash string
}

// NewFriendLink 创建新友链申请（初始态 pending）。
//
// 校验链：
//  1. name 非空且 ≤30 rune
//  2. url 非空且为 http/https
//  3. description ≤80 rune；avatarURL/linkbackURL 非空时须为 http/https
//  4. contactEmail 非空并归一化（小写 + trim）保证 (ip_hash, email) 配额稳定
func NewFriendLink(p CreateParams) (*FriendLink, error) {
	if err := validateFields(p.Name, p.URL, p.AvatarURL, p.Description, p.LinkbackURL); err != nil {
		return nil, err
	}
	email := NormalizeEmail(p.ContactEmail)
	if email == "" {
		return nil, shared.BadRequest("联系邮箱不能为空")
	}
	f := &FriendLink{
		id: p.ID, userID: p.UserID,
		name: strings.TrimSpace(p.Name), url: strings.TrimSpace(p.URL),
		avatarURL: strings.TrimSpace(p.AvatarURL), description: strings.TrimSpace(p.Description),
		ownerName: strings.TrimSpace(p.OwnerName), linkbackURL: strings.TrimSpace(p.LinkbackURL),
		contactEmail: email, ipHash: p.IPHash,
		status: StatusPending,
	}
	f.RecordEvent(NewFriendLinkCreated(f.id, f.name, f.url))
	return f, nil
}

// NewManual 站长手动添加友链（不走申请流，直接 approved）。
//
// 无 UserID/IPHash；ContactEmail 可空。排序值在创建时指定。
func NewManual(id shared.ID, name, siteURL, avatarURL, description, ownerName, linkbackURL, contactEmail string, sortOrder int) (*FriendLink, error) {
	if err := validateFields(name, siteURL, avatarURL, description, linkbackURL); err != nil {
		return nil, err
	}
	f := &FriendLink{
		id: id,
		name: strings.TrimSpace(name), url: strings.TrimSpace(siteURL),
		avatarURL: strings.TrimSpace(avatarURL), description: strings.TrimSpace(description),
		ownerName: strings.TrimSpace(ownerName), linkbackURL: strings.TrimSpace(linkbackURL),
		contactEmail: NormalizeEmail(contactEmail),
		status:       StatusApproved, sortOrder: sortOrder,
	}
	f.RecordEvent(NewFriendLinkCreated(f.id, f.name, f.url))
	return f, nil
}

// validateFields 构造与更新共用的字段校验。
func validateFields(name, siteURL, avatarURL, description, linkbackURL string) error {
	if strings.TrimSpace(name) == "" {
		return shared.BadRequest("站点名称不能为空")
	}
	if utf8.RuneCountInString(strings.TrimSpace(name)) > maxNameLen {
		return shared.BadRequest("站点名称不能超过 30 个字符")
	}
	if err := validateHTTPURL(siteURL, "站点 URL"); err != nil {
		return err
	}
	if utf8.RuneCountInString(strings.TrimSpace(description)) > maxDescriptionLen {
		return shared.BadRequest("描述不能超过 80 个字符")
	}
	// 可空 URL 字段：非空时同样要求 http/https（防 javascript: 等伪协议进前台渲染）
	if strings.TrimSpace(avatarURL) != "" {
		if err := validateHTTPURL(avatarURL, "头像 URL"); err != nil {
			return err
		}
	}
	if strings.TrimSpace(linkbackURL) != "" {
		if err := validateHTTPURL(linkbackURL, "回链页 URL"); err != nil {
			return err
		}
	}
	return nil
}

// validateHTTPURL 校验 URL 非空且为 http/https 绝对地址。
func validateHTTPURL(raw, label string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return shared.BadRequest(label + "不能为空")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return shared.BadRequest(label + "仅支持 http/https")
	}
	return nil
}

// NormalizeEmail 邮箱归一化：小写 + 去首尾空白（与评论域一致，保证配额 key 稳定）。
// 导出供 application 层复用（CodeStore key 与聚合根构造必须用同一份归一化）。
func NormalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ReconstructFriendLink 从持久化数据重建。
//
// userID 可空：匿名申请与手动添加为 nil。
func ReconstructFriendLink(id shared.ID, userID *shared.ID, name, siteURL, avatarURL, description, ownerName, linkbackURL, contactEmail, status string, sortOrder int, ipHash string, createdAt, updatedAt time.Time) *FriendLink {
	return &FriendLink{
		id: id, userID: userID,
		name: name, url: siteURL, avatarURL: avatarURL, description: description,
		ownerName: ownerName, linkbackURL: linkbackURL, contactEmail: contactEmail,
		status: status, sortOrder: sortOrder, ipHash: ipHash,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// ============================================================
// 状态转换（仅实际变更时 RecordEvent；非法转换拒绝）
// ============================================================

// Approve 批准（pending → approved；rejected → approved 改判）
func (f *FriendLink) Approve() error {
	if f.status != StatusPending && f.status != StatusRejected {
		return shared.Conflict("仅待审核或已拒绝的申请可以批准")
	}
	from := f.status
	f.status = StatusApproved
	f.RecordEvent(NewFriendLinkApproved(f.id, f.name, from))
	return nil
}

// Reject 拒绝（pending → rejected）
func (f *FriendLink) Reject() error {
	if f.status != StatusPending {
		return shared.Conflict("仅待审核的申请可以拒绝")
	}
	from := f.status
	f.status = StatusRejected
	f.RecordEvent(NewFriendLinkRejected(f.id, f.name, from))
	return nil
}

// Disable 下柜（approved → disabled）
func (f *FriendLink) Disable() error {
	if f.status != StatusApproved {
		return shared.Conflict("仅展示中的友链可以下柜")
	}
	from := f.status
	f.status = StatusDisabled
	f.RecordEvent(NewFriendLinkDisabled(f.id, f.name, from))
	return nil
}

// Restore 恢复（disabled → approved）
func (f *FriendLink) Restore() error {
	if f.status != StatusDisabled {
		return shared.Conflict("仅已下柜的友链可以恢复")
	}
	from := f.status
	f.status = StatusApproved
	f.RecordEvent(NewFriendLinkRestored(f.id, f.name, from))
	return nil
}

// UpdateParams Update 的入参（后台编辑字段/排序）。
type UpdateParams struct {
	Name         string
	URL          string
	AvatarURL    string
	Description  string
	OwnerName    string
	LinkbackURL  string
	ContactEmail string // 可空（手动添加的记录本来就没有）
	SortOrder    int
}

// Update 编辑友链字段与排序值（任意状态可编辑；状态转换走专用方法）。
//
// 仅实际变更时记录 FriendLinkUpdated 事件（同值直接返回，避免幂等调用产生噪音事件）。
func (f *FriendLink) Update(p UpdateParams) error {
	if err := validateFields(p.Name, p.URL, p.AvatarURL, p.Description, p.LinkbackURL); err != nil {
		return err
	}
	email := NormalizeEmail(p.ContactEmail)
	changes := make([]FriendLinkChange, 0, 8)
	diff := func(field, from, to string) {
		if from != to {
			changes = append(changes, FriendLinkChange{Field: field, From: from, To: to})
		}
	}
	diff("name", f.name, strings.TrimSpace(p.Name))
	diff("url", f.url, strings.TrimSpace(p.URL))
	diff("avatar_url", f.avatarURL, strings.TrimSpace(p.AvatarURL))
	diff("description", f.description, strings.TrimSpace(p.Description))
	diff("owner_name", f.ownerName, strings.TrimSpace(p.OwnerName))
	diff("linkback_url", f.linkbackURL, strings.TrimSpace(p.LinkbackURL))
	diff("contact_email", f.contactEmail, email)
	if f.sortOrder != p.SortOrder {
		changes = append(changes, FriendLinkChange{
			Field: "sort_order",
			From:  strconv.Itoa(f.sortOrder),
			To:    strconv.Itoa(p.SortOrder),
		})
	}
	if len(changes) == 0 {
		return nil
	}
	f.name = strings.TrimSpace(p.Name)
	f.url = strings.TrimSpace(p.URL)
	f.avatarURL = strings.TrimSpace(p.AvatarURL)
	f.description = strings.TrimSpace(p.Description)
	f.ownerName = strings.TrimSpace(p.OwnerName)
	f.linkbackURL = strings.TrimSpace(p.LinkbackURL)
	f.contactEmail = email
	f.sortOrder = p.SortOrder
	f.RecordEvent(NewFriendLinkUpdated(f.id, f.name, changes))
	return nil
}

// 访问器
func (f *FriendLink) ID() shared.ID { return f.id }

// UserID 返回登录申请者 id。匿名申请与手动添加为 nil。
func (f *FriendLink) UserID() *shared.ID  { return f.userID }
func (f *FriendLink) Name() string        { return f.name }
func (f *FriendLink) URL() string         { return f.url }
func (f *FriendLink) AvatarURL() string   { return f.avatarURL }
func (f *FriendLink) Description() string { return f.description }
func (f *FriendLink) OwnerName() string   { return f.ownerName }
func (f *FriendLink) LinkbackURL() string { return f.linkbackURL }

// ContactEmail 返回归一化后的联系邮箱（仅留存不公开，admin DTO 才带）。
func (f *FriendLink) ContactEmail() string     { return f.contactEmail }
func (f *FriendLink) Status() string           { return f.status }
func (f *FriendLink) SortOrder() int           { return f.sortOrder }
func (f *FriendLink) IPHash() string           { return f.ipHash }
func (f *FriendLink) CreatedAt() time.Time     { return f.timestamps.CreatedAt }
func (f *FriendLink) UpdatedAt() time.Time     { return f.timestamps.UpdatedAt }
func (f *FriendLink) IsApproved() bool         { return f.status == StatusApproved }
