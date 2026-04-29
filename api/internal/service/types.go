package service

import (
	"github.com/google/uuid"

	"blog-api/internal/repository/generated"
)

// CreatePostRequest 创建文章请求
type CreatePostRequest struct {
	// Title 文章标题
	Title string `json:"title" validate:"required,min=1,max=255"`
	// Slug URL 标识符，为空时自动生成
	Slug string `json:"slug"`
	// ContentMarkdown Markdown 格式的文章内容
	ContentMarkdown string `json:"content_markdown" validate:"required"`
	// Excerpt 文章摘要
	Excerpt string `json:"excerpt"`
	// CoverImage 封面图片链接
	CoverImage string `json:"cover_image"`
	// Status 文章状态：draft/published/archived
	Status string `json:"status"`
	// IsFeatured 是否置顶
	IsFeatured bool `json:"is_featured"`
	// SEOTitle SEO 标题
	SEOTitle string `json:"seo_title"`
	// SEODescription SEO 描述
	SEODescription string `json:"seo_description"`
	// TagIDs 标签 ID 列表
	TagIDs []int32 `json:"tag_ids"`
}

// UpdatePostRequest 更新文章请求
type UpdatePostRequest struct {
	// Title 文章标题
	Title string `json:"title"`
	// Slug URL 标识符
	Slug string `json:"slug"`
	// ContentMarkdown Markdown 格式的文章内容
	ContentMarkdown string `json:"content_markdown"`
	// Excerpt 文章摘要
	Excerpt string `json:"excerpt"`
	// CoverImage 封面图片链接
	CoverImage string `json:"cover_image"`
	// IsFeatured 是否置顶
	IsFeatured bool `json:"is_featured"`
	// SEOTitle SEO 标题
	SEOTitle string `json:"seo_title"`
	// SEODescription SEO 描述
	SEODescription string `json:"seo_description"`
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
