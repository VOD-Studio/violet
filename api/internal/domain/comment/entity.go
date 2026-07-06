// Package comment 定义评论聚合的领域模型。
//
// 评论支持回复（两层扁平，物化路径聚合），含状态机（pending/approved/spam/deleted）。
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

// MaxDepth 展示层级上限。
// 0 是顶层评论，1 是回复。回复不再往下嵌套（B站式两层扁平）——
// 回复另一条回复时，depth 还是 1，对话关系靠 parent_id 和 reply_to_name 标。
const MaxDepth = 1

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
// 锚点定位采用「块内 offset」方案：锚点挂在选区所在的块级元素上（<p>/<h2>/<li>/<pre>），
// offset 以该块的纯文本为基准（不跨块）。持久化五元组，重定位三态机：
//   - block_text_hash 匹配   → 直接用 offset（快路径，99% 场景）
//   - block_text_hash 不匹配 → 在该块用 selected_text 子串查找 + 前后 16 字 context 唯一化
//   - 全部失败               → 降级为页面级评论（不丢失内容）
type Anchor struct {
	// BlockID 块标识符 = 块纯文本的 SHA1 前 8 位。
	// 跨 SSR/客户端渲染一致，跨同篇文章稳定（同一 MD 源文生成同一 hash）。
	// 用于在文章渲染后定位「这个锚点属于哪个块」。
	BlockID string

	// StartOffset 选区起始位置，以所在块的纯文本为基准的字符偏移（0-based）。
	StartOffset int

	// EndOffset 选区结束位置，以所在块的纯文本为基准的字符偏移（exclusive，> StartOffset）。
	EndOffset int

	// SelectedText 选中的原文。作为 fuzzy 重定位的锚（block_text_hash 不匹配时按子串查找）。
	SelectedText string

	// BlockHashSync 锚点创建时所在块的内容快照（SHA1 前 8 位，与 BlockID 同算法）。
	// 用于漂移检测：当前块 hash 与之不匹配说明文章被改过，触发 fuzzy 重定位。
	// 字段名带 Sync 强调它是「创建时的快照」，与 BlockID（运行时计算）对照。
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

// Comment 评论聚合根。
//
// 一条评论可以是「自由评论」（anchor 为空，挂在文章底部）或「选区批注」
//（anchor 非空，锚到正文某段文本）。两种形态共用同一张表与同一聚合，
// 通过 anchor 字段是否为空分流（PRD-0001 双轨制）。
type Comment struct {
	shared.AggregateRoot

	id     shared.ID // 评论唯一 id
	postID shared.ID // 所属文章 id

	// userID 评论者的用户 id（登录评论者）。
	// 匿名为 nil。双轨认证关键字段：anchor 非空时必须非空（批注强制登录）。
	// 决策依据 PRD-0001：划线批注是身份可见的高亮动作，不允许匿名。
	userID *shared.ID

	// parentID 被回复的评论 id。顶层评论为 nil。
	// 两层扁平下：回复顶层评论 → parent_id 指向那条顶层；
	// 回复另一条回复 → parent_id 指向被回复者，但 depth 还是 1（不往下嵌套）。
	parentID *shared.ID
	// path 物化路径 <uuid>/<uuid>/...。同一顶层评论下的所有回复共享前缀，
	// 方便按顶层聚合查整棵子树。
	path string
	// depth 展示层级。0 是顶层评论，1 是回复。见 MaxDepth。
	depth int16

	// anchor 选区批注锚点。非空表示这是一条批注（锚到正文文本）；
	// 为 nil 表示自由评论（挂文章底部）。批注强制登录（见 userID）。
	anchor *Anchor

	authorName  string // 评论者显示昵称（登录态从 user 资料快照，匿名态手填）
	authorEmail string // 评论者邮箱，已归一化（小写 + trim）。匿名配额按 (ip_hash, email) 识别。
	authorURL   string // 评论者个人站点 URL（可选，匿名态可填）
	avatarURL   string // 头像 URL（登录态从 user 资料快照）

	body     string    // 评论正文（纯文本 + emoji 语法，沿用 027 迁移的 Bilibili 哲学，无 Markdown）
	pictures []Picture // 评论附图数组（Bilibili 式，handler 接线后可用）

	status     string // 审核状态：pending/approved/spam/deleted，默认 pending（人工审核）
	ipHash     string // 评论者 IP 的 SHA256（防伪造，由 handler 用 middleware.GetClientIP 算）。匿名配额依赖。
	userAgent  string // 评论者 User-Agent（反垃圾元数据）

	timestamps shared.Timestamps // 创建/更新时间
}

// Picture 评论图片（Bilibili 式附图，每张含显示尺寸与体积元数据）。
type Picture struct {
	URL    string `json:"url"`    // 图片访问 URL
	Width  int    `json:"width"`  // 像素宽
	Height int    `json:"height"` // 像素高
	Size   int64  `json:"size"`   // 字节体积
}

// CreateParams NewComment 的入参（options 模式，便于扩展）。
type CreateParams struct {
	ID          shared.ID
	PostID      shared.ID
	UserID      *shared.ID // 登录用户 id；nil 表示匿名（双轨认证）
	Anchor      *Anchor    // 选区批注锚点；nil 表示自由评论。Anchor 非空时 UserID 必须非空。
	AuthorName  string
	AuthorEmail string // 原始输入，NewComment 内部会归一化（小写 + trim）
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

// SetParent 设置被回复的评论。
//
// 两层扁平语义（B站式）：回复一律 depth=1，不往下嵌套。
//   - parent 是顶层（depth=0）→ 新评论 depth=1
//   - parent 是回复（depth=1）→ 新评论 depth 还是 1，parent_id 指被回复者
//
// path 始终挂到「顶层祖先」下面，保证同棵树前缀一致，便于按顶层聚合查子树。
func (c *Comment) SetParent(parent *Comment) error {
	if parent == nil {
		c.depth = 0
		c.path = c.id.String() + "/"
		return nil
	}
	c.depth = 1
	c.parentID = &parent.id
	c.path = topAncestorPath(parent.path) + c.id.String() + "/"
	return nil
}

// topAncestorPath 取物化路径的第一段（顶层祖先的 id）。
// 例如 "aaa/bbb/ccc/" → "aaa/"。用于 SetParent 时把回复挂到顶层祖先下。
// 入参 path 为空时返回空串（防御，正常不会走到）。
func topAncestorPath(path string) string {
	if path == "" {
		return ""
	}
	idx := strings.Index(path, "/")
	if idx < 0 {
		return path + "/"
	}
	return path[:idx+1]
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

// SetIPHash 设置 ip_hash。
// 由 handler 层从 middleware.GetClientIP 取真实 IP + SHA256 后填充（不存明文 IP）。
// 匿名评论的 per-post 配额依赖此字段：配额 key = (ip_hash, author_email)。
func (c *Comment) SetIPHash(h string) { c.ipHash = h }

// SetUserAgent 设置 user_agent（反垃圾元数据，handler 从 request header 填）。
func (c *Comment) SetUserAgent(ua string) { c.userAgent = ua }

// 访问器
func (c *Comment) ID() shared.ID        { return c.id }
func (c *Comment) PostID() shared.ID    { return c.postID }

// UserID 返回评论者用户 id。匿名为 nil；登录非空。
// 用于 ListByPost 黑洞模式判定（登录才返回评论）与作者高亮（== post.author_id）。
func (c *Comment) UserID() *shared.ID { return c.userID }

func (c *Comment) ParentID() *shared.ID { return c.parentID }
func (c *Comment) Path() string         { return c.path }
func (c *Comment) Depth() int16         { return c.depth }

// Anchor 返回选区批注锚点。nil 表示这是一条自由评论（非批注）。
func (c *Comment) Anchor() *Anchor { return c.anchor }

// SetInheritedAnchor 继承父评论的锚点。回复批注时调用，让回复挂在同一高亮区。
// 仅 service.Create 在「parent 有 anchor 且当前评论没传 anchor」时调用。
func (c *Comment) SetInheritedAnchor(a *Anchor) { c.anchor = a }
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

