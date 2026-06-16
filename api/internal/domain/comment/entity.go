// Package comment 定义评论聚合的领域模型。
//
// 评论支持嵌套（物化路径，最大深度 4），含状态机（pending/approved/spam/deleted）。
// 反应（emoji 点赞）作为独立聚合通过 comment_id 关联。
package comment

import (
	"regexp"
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

// Comment 评论聚合根
type Comment struct {
	shared.AggregateRoot

	id          shared.ID
	postID      shared.ID
	parentID    *shared.ID
	path        string
	depth       int16
	authorName  string
	authorEmail string
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

// NewComment 创建新评论
func NewComment(id, postID shared.ID, authorName, authorEmail, body string) (*Comment, error) {
	if body == "" {
		return nil, shared.BadRequest("评论内容不能为空")
	}
	if authorName == "" {
		return nil, shared.BadRequest("昵称不能为空")
	}
	return &Comment{
		id: id, postID: postID,
		authorName: authorName, authorEmail: authorEmail,
		body: body, status: StatusPending,
		pictures: []Picture{},
	}, nil
}

// ReconstructComment 从持久化数据重建
func ReconstructComment(id, postID shared.ID, parentID *shared.ID, path string, depth int16,
	authorName, authorEmail, authorURL, avatarURL, body string, pictures []Picture,
	status, ipHash, userAgent string, createdAt, updatedAt time.Time) *Comment {
	if pictures == nil {
		pictures = []Picture{}
	}
	return &Comment{
		id: id, postID: postID, parentID: parentID, path: path, depth: depth,
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

// 访问器
func (c *Comment) ID() shared.ID        { return c.id }
func (c *Comment) PostID() shared.ID    { return c.postID }
func (c *Comment) ParentID() *shared.ID { return c.parentID }
func (c *Comment) Path() string         { return c.path }
func (c *Comment) Depth() int16         { return c.depth }
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
