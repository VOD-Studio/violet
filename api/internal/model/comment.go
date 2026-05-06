// Package model 定义 GORM 数据模型
package model

import (
	"time"

	"github.com/google/uuid"
)

// Comment 评论模型（GORM）
type Comment struct {
	// ID 评论唯一标识
	ID uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	// PostID 所属文章 ID
	PostID uuid.UUID `gorm:"type:uuid;not null;index" json:"post_id"`
	// ParentID 父评论 ID，为空表示顶级评论
	ParentID *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	// Path 评论路径，用于树形结构排序（如 "uuid1.uuid2.uuid3"）
	Path string `gorm:"type:text;not null;index" json:"path"`
	// Depth 评论嵌套深度（0 表示顶级评论，最大 4 层）
	Depth int16 `gorm:"type:smallint;not null;default:0" json:"depth"`
	// AuthorName 评论者昵称
	AuthorName string `gorm:"type:varchar(100);not null" json:"author_name"`
	// AuthorEmail 评论者邮箱（可选）
	AuthorEmail *string `gorm:"type:varchar(255)" json:"author_email,omitempty"`
	// AuthorURL 评论者网站（可选）
	AuthorURL *string `gorm:"type:text" json:"author_url,omitempty"`
	// AvatarURL 评论者头像地址（可选）
	AvatarURL *string `gorm:"type:varchar(512)" json:"avatar_url,omitempty"`
	// Body 评论内容（纯文本 + 表情语法，如 "测试[smile]"）
	Body string `gorm:"type:text;not null" json:"body"`
	// Pictures 评论图片数组（JSONB 格式存储）
	Pictures []byte `gorm:"type:jsonb;default:'[]'::jsonb" json:"pictures"`
	// Status 评论状态：pending 待审核，approved 已通过，spam 垃圾评论，deleted 已删除
	Status string `gorm:"type:varchar(20);not null;default:'pending';check:status IN ('pending','approved','spam','deleted')" json:"status"`
	// IPHash 评论者 IP 地址的 SHA256 哈希值（用于防刷和统计，不返回给前端）
	IPHash *string `gorm:"type:varchar(64)" json:"-"`
	// UserAgent 评论者浏览器 UA（用于统计和反垃圾，不返回给前端）
	UserAgent *string `gorm:"type:text" json:"-"`
	// CreatedAt 创建时间
	CreatedAt time.Time `gorm:"not null;default:now()" json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `gorm:"not null;default:now()" json:"updated_at"`
}

// TableName 指定表名
func (Comment) TableName() string {
	return "comments"
}

// CommentPicture 评论图片信息
type CommentPicture struct {
	// URL 图片地址（原图）
	URL string `json:"url"`
	// Thumbnail 缩略图地址
	Thumbnail string `json:"thumbnail"`
	// Width 图片宽度（像素）
	Width int `json:"width"`
	// Height 图片高度（像素）
	Height int `json:"height"`
	// Size 图片大小（KB）
	Size float64 `json:"size"`
}

// CommentWithPost 评论与文章信息的组合结构（用于管理后台列表）
// 不嵌入 Comment 避免 nil 指针导致的 TableName panic
type CommentWithPost struct {
	// ID 评论唯一标识
	ID uuid.UUID `json:"id"`
	// PostID 所属文章 ID
	PostID uuid.UUID `json:"post_id"`
	// ParentID 父评论 ID
	ParentID *uuid.UUID `json:"parent_id"`
	// Path 评论路径
	Path string `json:"path"`
	// Depth 评论嵌套深度
	Depth int16 `json:"depth"`
	// AuthorName 评论者昵称
	AuthorName string `json:"author_name"`
	// AuthorEmail 评论者邮箱
	AuthorEmail *string `json:"author_email"`
	// AuthorURL 评论者网站
	AuthorURL *string `json:"author_url"`
	// AvatarURL 评论者头像地址
	AvatarURL *string `json:"avatar_url"`
	// Body 评论内容
	Body string `json:"body"`
	// Pictures 评论图片（JSONB）
	Pictures []byte `json:"pictures"`
	// Status 评论状态
	Status string `json:"status"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updated_at"`
	// PostTitle 文章标题
	PostTitle string `json:"post_title"`
}

// TableName 指定表名
func (CommentWithPost) TableName() string {
	return "comments"
}
