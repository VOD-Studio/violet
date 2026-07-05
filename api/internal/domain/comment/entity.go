// Package comment 定义评论聚合的领域模型。
//
// 评论支持嵌套（物化路径，最大深度 4），含状态机（pending/approved/spam/deleted）。
// 反应（emoji 点赞）作为独立聚合通过 comment_id 关联。
//
// 认证模型（PRD-0001 双轨制）：
//   - 匿名自由评论：UserID 为 nil，Anchor 必须为 nil
//   - 登录自由评论：UserID 非空，Anchor 为 nil
//   - 登录批注：    UserID 非空，Anchor 非空（批注强制登录）
//   - 匿名批注：    非法（Anchor 非空 + UserID 为 nil）
package comment

import (
	"regexp"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

// 状态枚举
const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusSpam     = "spam"
	StatusDeleted  = "deleted"
)

// MaxDepth 最大嵌套深度
const MaxDepth = 4

// 状态合法性
func IsValidStatus(s string) bool {
	switch s {
	case StatusPending, StatusApproved, StatusSpam, StatusDeleted:
			return true
	}
	return false
}

// pathPattern 物化路径格式：<uuid>/<uuid>/...
var pathPattern = regexp.MustCompile(`^[0-9a-f\-/]*$`)

// Anchor 锚点值对象（PRD-0001 选区批注的五元组定位）。
//
// block_id 为块纯文本 SHA1 前 8 位（跨渲染稳定）；offset 以块内纯文本为基准；
// block_text_hash 用于漂移检测，不匹配时进入单块 fuzzy 重定位。
type Anchor struct {
	BlockID       string
	StartOffset   int
	EndOffset     int
	SelectedText  string
	BlockHashSync string
}

// Validate 校验五元组完整性。
func (a *Anchor) Validate() error {
	if a.BlockID == "" {
		return shared.BadRequest("锚点 block_id 不能为空")
	}
	if a.StartOffset < 0 {
		return shared.BadRequest("锚点 start_offset 不能为负")
	}
	if a.EndOffset <= a.StartOffset {
		return shared.BadRequest("锚点 end_offset 必须大于 start_offset")
	}
	if a.SelectedText == "" {
		return shared.BadRequest("锚点 selected_text 不能为空")
	}
	if a.BlockHashSync == "" {
		return shared.BadRequest("锚点 block_text_hash 不能为空")
	}
	return nil
}

// Comment 评论聚合根
type Comment struct {
	shared.AggregateRoot

	id          shared.ID
	postID      shared.ID
	userID      *shared.ID // 登录用户 id（匿名为 nil）
	parentID    *shared.ID
	path        string
	depth       int16
	anchor      *Anchor // 选区批注锚点（自由评论为 nil）
	authorName  string
	authorEmail string // 已归一化（小写 + trim）
	authorURL   string
	avatarURL   string
	body        string
	pictures    []Picture
	status      string
	ipHash      string
	userAgent   string
	timestamps  shared.Timestamps
}

// Picture 评论图片
type Picture struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Size   int64  `json:"size"`
}

// CreateParams NewComment 的入参（options 模式，便于扩展）。
type CreateParams struct {
	ID          shared.ID
	PostID      shared.ID
	UserID      *shared.ID // 登录用户 id；nil 表示匿名
	Anchor      *Anchor    // 选区批注锚点；nil 表示自由评论
	AuthorName  string
	AuthorEmail string // 原始输入，会被归一化
	AuthorURL   string
	AvatarURL   string
	Body        string
}

// NewComment 创建新评论。
//
// 校验链：
//  1. body / authorName 非空
//  2. 双轨认证：Anchor 非空时 UserID 必须非空（批注强制登录）
//  3. Anchor 非空时五元组完整性
//  4. AuthorEmail 归一化（小写 + trim）保证 per-post 配额稳定
func NewComment(p CreateParams) (*Comment, error) {
	if p.Body == "" {
		return nil, shared.BadRequest("评论内容不能为空")
	}
	if p.AuthorName == "" {
		return nil, shared.BadRequest("昵称不能为空")
	}
	// 双轨认证核心约束：批注强制登录。
	if p.Anchor != nil && p.UserID == nil {
		return nil, shared.Unauthorized("划线批注需要登录")
	}
	if p.Anchor != nil {
		if err := p.Anchor.Validate(); err != nil {
			return nil, err
		}
	}
	return &Comment{
		id: p.ID, postID: p.PostID, userID: p.UserID, anchor: p.Anchor,
		authorName: p.AuthorName, authorEmail: normalizeEmail(p.AuthorEmail),
		authorURL: p.AuthorURL, avatarURL: p.AvatarURL,
		body: p.Body, status: StatusPending,
		pictures: []Picture{},
	}, nil
}

// normalizeEmail 邮箱归一化：小写 + 去首尾空白。
// 保证 per-post 匿名配额稳定（否则 "Alice@X.com" 与 "alice@x.com " 会被识别为不同身份）。
func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ReconstructComment 从持久化数据重建。
//
// userID / anchor 为可空：匿名评论 userID 为 nil，自由评论 anchor 为 nil。
func ReconstructComment(id, postID shared.ID, userID *shared.ID, parentID *shared.ID, path string, depth int16,
	anchor *Anchor, authorName, authorEmail, authorURL, avatarURL, body string, pictures []Picture,
	status, ipHash, userAgent string, createdAt, updatedAt time.Time) *Comment {
	if pictures == nil {
		pictures = []Picture{}
	}
	return &Comment{
		id: id, postID: postID, userID: userID, parentID: parentID, path: path, depth: depth,
		anchor: anchor,
		authorName: authorName, authorEmail: authorEmail,
		authorURL: authorURL, avatarURL: avatarURL,
		body: body, pictures: pictures, status: status,
		ipHash: ipHash, userAgent: userAgent,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetParent 设置父评论（嵌套回复）
//
// 业务规则：深度不超过 MaxDepth。
func (c *Comment) SetParent(parent *Comment) error {
	if parent == nil {
		c.depth = 0
		c.path = c.id.String() + "/"
		return nil
	}
	newDepth := parent.depth + 1
	if newDepth > MaxDepth {
		return shared.BadRequest("评论嵌套深度超过限制")
	}
	c.parentID = &parent.id
	c.depth = newDepth
	c.path = parent.path + c.id.String() + "/"
	return nil
}

// Approve 审核通过
func (c *Comment) Approve() { c.status = StatusApproved }

// MarkSpam 标记为垃圾
func (c *Comment) MarkSpam() { c.status = StatusSpam }

// SoftDelete 软删除
func (c *Comment) SoftDelete() { c.status = StatusDeleted }

// IsApproved 是否已审核通过
func (c *Comment) IsApproved() bool { return c.status == StatusApproved }

// SetPictures 设置评论图片
func (c *Comment) SetPictures(pics []Picture) {
	if pics == nil {
		pics = []Picture{}
	}
	c.pictures = pics
}

// SetIPHash 设置 ip_hash（由 handler 层从 middleware.GetClientIP 计算 SHA256 后填充）。
func (c *Comment) SetIPHash(h string) { c.ipHash = h }

// SetUserAgent 设置 user_agent。
func (c *Comment) SetUserAgent(ua string) { c.userAgent = ua }

// 访问器
func (c *Comment) ID() shared.ID        { return c.id }
func (c *Comment) PostID() shared.ID    { return c.postID }
func (c *Comment) UserID() *shared.ID   { return c.userID }
func (c *Comment) ParentID() *shared.ID { return c.parentID }
func (c *Comment) Path() string         { return c.path }
func (c *Comment) Depth() int16         { return c.depth }
func (c *Comment) Anchor() *Anchor      { return c.anchor }
func (c *Comment) AuthorName() string   { return c.authorName }
func (c *Comment) AuthorEmail() string  { return c.authorEmail }
func (c *Comment) AuthorURL() string    { return c.authorURL }
func (c *Comment) AvatarURL() string    { return c.avatarURL }
func (c *Comment) Body() string         { return c.body }
func (c *Comment) Pictures() []Picture  { return c.pictures }
func (c *Comment) Status() string       { return c.status }
func (c *Comment) IPHash() string       { return c.ipHash }
func (c *Comment) UserAgent() string    { return c.userAgent }
func (c *Comment) CreatedAt() time.Time { return c.timestamps.CreatedAt }
func (c *Comment) UpdatedAt() time.Time { return c.timestamps.UpdatedAt }

// 校验 path 格式
func IsValidPath(p string) bool { return pathPattern.MatchString(p) }

