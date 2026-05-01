package service

import (
	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// CreatePostRequest 创建文章请求
type CreatePostRequest struct {
	Title          string   `json:"title" validate:"required,min=1,max=255"`
	Slug           string   `json:"slug"`
	ContentMarkdown string  `json:"content_markdown" validate:"required"`
	Excerpt        string   `json:"excerpt"`
	CoverImage     string   `json:"cover_image"`
	Status         string   `json:"status"`
	IsFeatured     bool     `json:"is_featured"`
	SEOTitle       string   `json:"seo_title"`
	SEODescription string   `json:"seo_description"`
	SEOKeywords    string   `json:"seo_keywords"`
	TagIDs         []int32  `json:"tag_ids"`
}

// UpdatePostRequest 更新文章请求
type UpdatePostRequest struct {
	Title           string   `json:"title"`
	Slug            string   `json:"slug"`
	ContentMarkdown string   `json:"content_markdown"`
	Excerpt         string   `json:"excerpt"`
	CoverImage      string   `json:"cover_image"`
	IsFeatured      bool     `json:"is_featured"`
	SEOTitle        string   `json:"seo_title"`
	SEODescription  string   `json:"seo_description"`
	SEOKeywords     string   `json:"seo_keywords"`
	TagIDs          []int32  `json:"tag_ids"`
}

// PostDetail 文章详情（包含标签信息）
type PostDetail struct {
	// Post 文章信息
	Post *generated.Post
	// Tags 文章标签列表
	Tags []*generated.Tag
}

// ListPostsParams 文章列表查询参数
type ListPostsParams struct {
	// Page 页码
	Page int
	// Limit 每页数量
	Limit int
	// Status 状态筛选
	Status string
	// TagID 标签筛选
	TagID int
	// Search 搜索关键词
	Search string
}

// ListPostsResult 文章列表查询结果
type ListPostsResult struct {
	// Posts 文章列表
	Posts []*generated.Post
	// Total 总数
	Total int64
	// Page 当前页码
	Page int
	// Limit 每页数量
	Limit int
}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	// Title 项目标题
	Title string `json:"title" validate:"required,min=1,max=255"`
	// Description 项目描述
	Description string `json:"description"`
	// URL 项目演示地址
	URL string `json:"url"`
	// GithubURL 项目 GitHub 地址
	GithubURL string `json:"github_url"`
	// ImageURL 项目封面图
	ImageURL string `json:"image_url"`
	// TechStack 技术栈
	TechStack []string `json:"tech_stack"`
	// SortOrder 排序权重
	SortOrder int `json:"sort_order"`
}

// UpdateProjectRequest 更新项目请求
type UpdateProjectRequest struct {
	// Title 项目标题
	Title string `json:"title"`
	// Description 项目描述
	Description string `json:"description"`
	// URL 项目演示地址
	URL string `json:"url"`
	// GithubURL 项目 GitHub 地址
	GithubURL string `json:"github_url"`
	// ImageURL 项目封面图
	ImageURL string `json:"image_url"`
	// TechStack 技术栈
	TechStack []string `json:"tech_stack"`
	// SortOrder 排序权重
	SortOrder int `json:"sort_order"`
}

// CreateCommentRequest 创建评论请求
type CreateCommentRequest struct {
	// PostID 所属文章 ID
	PostID uuid.UUID `json:"post_id" validate:"required"`
	// ParentID 父评论 ID，为空表示顶级评论
	ParentID *uuid.UUID `json:"parent_id"`
	// AuthorName 评论者昵称
	AuthorName string `json:"author_name" validate:"required,min=1,max=100"`
	// AuthorEmail 评论者邮箱
	AuthorEmail string `json:"author_email"`
	// AuthorURL 评论者网站
	AuthorURL string `json:"author_url"`
	// AvatarURL 头像链接
	AvatarURL string `json:"avatar_url"`
	// Content Markdown 格式的评论内容
	Content string `json:"content" validate:"required,min=1,max=4096"`
}
