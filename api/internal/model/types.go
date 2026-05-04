// Package model 定义应用的核心数据模型和类型
package model

import (
	"time"

	"github.com/google/uuid"
)

// User 用户信息
type User struct {
	// ID 用户唯一标识
	ID uuid.UUID `json:"id"`
	// Username 用户名，用于登录和显示
	Username string `json:"username"`
	// Email 邮箱地址，用于登录和通知
	Email string `json:"email"`
	// PasswordHash 密码哈希值，不返回给前端
	PasswordHash string `json:"-"`
	// AvatarURL 头像链接
	AvatarURL string `json:"avatar_url"`
	// Bio 个人简介
	Bio string `json:"bio"`
	// Role 用户角色：admin 管理员，user 普通用户
	Role string `json:"role"`
	// EmailVerified 邮箱是否已验证
	EmailVerified bool `json:"email_verified"`
	// IsActive 账户是否已激活
	IsActive bool `json:"is_active"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updated_at"`
}

// Post 博客文章
type Post struct {
	// ID 文章唯一标识
	ID uuid.UUID `json:"id"`
	// Title 文章标题
	Title string `json:"title"`
	// Slug URL 友好的标识符
	Slug string `json:"slug"`
	// ContentMarkdown Markdown 格式的文章内容
	ContentMarkdown string `json:"content_markdown"`
	// ContentHTML 渲染后的 HTML 内容
	ContentHTML string `json:"content_html"`
	// Excerpt 文章摘要
	Excerpt string `json:"excerpt"`
	// CoverImageURL 封面图片链接
	CoverImageURL string `json:"cover_image_url"`
	// AuthorID 作者用户 ID
	AuthorID uuid.UUID `json:"author_id"`
	// Status 文章状态：draft 草稿，published 已发布，archived 已归档
	Status string `json:"status"`
	// ViewCount 浏览次数
	ViewCount int64 `json:"view_count"`
	// PublishedAt 发布时间
	PublishedAt *time.Time `json:"published_at"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updated_at"`
}

// Tag 文章标签
type Tag struct {
	// ID 标签唯一标识
	ID int32 `json:"id"`
	// Name 标签名称
	Name string `json:"name"`
	// Slug URL 友好的标识符
	Slug string `json:"slug"`
}

// Project 个人项目展示
type Project struct {
	// ID 项目唯一标识
	ID uuid.UUID `json:"id"`
	// Title 项目名称
	Title string `json:"title"`
	// Description 项目描述
	Description string `json:"description"`
	// ImageURL 项目展示图片链接
	ImageURL string `json:"image_url"`
	// ProjectURL 项目在线地址
	ProjectURL string `json:"project_url"`
	// RepoURL 项目仓库地址
	RepoURL string `json:"repo_url"`
	// TechStack 使用的技术栈
	TechStack []string `json:"tech_stack"`
	// SortOrder 排序权重，数值越小越靠前
	SortOrder int `json:"sort_order"`
	// IsVisible 是否在前端展示
	IsVisible bool `json:"is_visible"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updated_at"`
}
