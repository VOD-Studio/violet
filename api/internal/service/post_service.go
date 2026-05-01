package service

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/yuin/goldmark"

	"blog-api/internal/repository/generated"
)

// 文章相关错误定义
var (
	ErrPostNotFound    = errors.New("文章不存在")
	ErrSlugExists      = errors.New("slug 已存在")
	ErrInvalidStatus   = errors.New("无效的文章状态")
	ErrPostSlugInvalid = errors.New("slug 格式无效")
)

// 合法的文章状态列表
var validPostStatuses = map[string]bool{
	"draft":     true,
	"published": true,
	"archived":  true,
}

// PostService 文章业务服务
type PostService struct {
	queries *generated.Queries
	md      goldmark.Markdown
}

// NewPostService 创建文章服务实例
func NewPostService(queries *generated.Queries) *PostService {
	return &PostService{
		queries: queries,
		md:      goldmark.New(),
	}
}

// CreatePost 创建文章
// 自动生成 slug，将 Markdown 渲染为 HTML
func (s *PostService) CreatePost(ctx context.Context, req CreatePostRequest, authorID uuid.UUID) (*generated.Post, error) {
	// 生成 slug
	slug := req.Slug
	if slug == "" {
		slug = GenerateSlug(req.Title)
	}

	// 验证 slug 格式
	if !isValidSlug(slug) {
		return nil, ErrPostSlugInvalid
	}

	// 检查 slug 是否已存在
	_, err := s.queries.GetPostBySlug(ctx, slug)
	if err == nil {
		// slug 已存在，追加随机后缀
		slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("查询 slug 失败: %w", err)
	}

	// 渲染 Markdown 为 HTML
	html, err := s.renderMarkdown(req.ContentMarkdown)
	if err != nil {
		return nil, fmt.Errorf("渲染 Markdown 失败: %w", err)
	}

	// 确定文章状态
	status := req.Status
	if status == "" {
		status = "draft"
	}
	if !validPostStatuses[status] {
		return nil, ErrInvalidStatus
	}

	// 构建摘要
	excerpt := sql.NullString{}
	if req.Excerpt != "" {
		excerpt = sql.NullString{String: req.Excerpt, Valid: true}
	}

	// 构建封面图
	coverImage := sql.NullString{}
	if req.CoverImage != "" {
		coverImage = sql.NullString{String: req.CoverImage, Valid: true}
	}

	// 构建 SEO 字段
	seoTitle := sql.NullString{}
	if req.SEOTitle != "" {
		seoTitle = sql.NullString{String: req.SEOTitle, Valid: true}
	}
	seoDesc := sql.NullString{}
	if req.SEODescription != "" {
		seoDesc = sql.NullString{String: req.SEODescription, Valid: true}
	}
	seoKeywords := sql.NullString{}
	if req.SEOKeywords != "" {
		seoKeywords = sql.NullString{String: req.SEOKeywords, Valid: true}
	}

	// 创建文章记录
	post, err := s.queries.CreatePost(ctx, generated.CreatePostParams{
		Title:          req.Title,
		Slug:           slug,
		ContentMd:      req.ContentMarkdown,
		ContentHtml:    html,
		Excerpt:        excerpt,
		CoverImage:     coverImage,
		Status:         status,
		AuthorID:       authorID,
		IsFeatured:     req.IsFeatured,
		SeoTitle:       seoTitle,
		SeoDescription: seoDesc,
		SeoKeywords:    seoKeywords,
		PublishedAt:    sql.NullTime{}, // 发布时间由 UpdatePostStatus 设置
	})
	if err != nil {
		return nil, fmt.Errorf("创建文章失败: %w", err)
	}

	return post, nil
}

// GetPostBySlug 按 slug 获取文章详情
func (s *PostService) GetPostBySlug(ctx context.Context, slug string) (*PostDetail, error) {
	post, err := s.queries.GetPostBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, fmt.Errorf("查询文章失败: %w", err)
	}

	// 查询文章标签
	tags, err := s.queries.ListPostTags(ctx, post.ID)
	if err != nil {
		return nil, fmt.Errorf("查询文章标签失败: %w", err)
	}

	return &PostDetail{
		Post: post,
		Tags: tags,
	}, nil
}

// GetPostByID 按 ID 获取文章
func (s *PostService) GetPostByID(ctx context.Context, id uuid.UUID) (*generated.Post, error) {
	post, err := s.queries.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, fmt.Errorf("查询文章失败: %w", err)
	}
	return post, nil
}

// ListPostTags 获取文章的标签列表
func (s *PostService) ListPostTags(ctx context.Context, postID uuid.UUID) ([]*generated.Tag, error) {
	tags, err := s.queries.ListPostTags(ctx, postID)
	if err != nil {
		return nil, fmt.Errorf("查询文章标签失败: %w", err)
	}
	return tags, nil
}

// ListPosts 分页查询文章列表

// ListPosts 分页查询文章列表
func (s *PostService) ListPosts(ctx context.Context, params ListPostsParams) (*ListPostsResult, error) {
	// 设置默认分页参数
	page := params.Page
	if page < 1 {
		page = 1
	}
	limit := params.Limit
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	// 查询文章列表
	posts, err := s.queries.ListPosts(ctx, generated.ListPostsParams{
		Status: params.Status,
		TagID:  int32(params.TagID),
		Search: params.Search,
		Off:    int32(offset),
		Lim:    int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("查询文章列表失败: %w", err)
	}

	// 查询总数
	total, err := s.queries.CountPosts(ctx, generated.CountPostsParams{
		Status: params.Status,
		TagID:  int32(params.TagID),
		Search: params.Search,
	})
	if err != nil {
		return nil, fmt.Errorf("统计文章数失败: %w", err)
	}

	return &ListPostsResult{
		Posts: posts,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// UpdatePost 更新文章
func (s *PostService) UpdatePost(ctx context.Context, id uuid.UUID, req UpdatePostRequest) (*generated.Post, error) {
	// 查询现有文章
	existing, err := s.queries.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, fmt.Errorf("查询文章失败: %w", err)
	}

	// 使用现有值作为默认值
	title := existing.Title
	slug := existing.Slug
	contentMd := existing.ContentMd
	contentHtml := existing.ContentHtml
	excerpt := existing.Excerpt
	coverImage := existing.CoverImage
	isFeatured := existing.IsFeatured
	seoTitle := existing.SeoTitle
	seoDesc := existing.SeoDescription
	seoKeywords := existing.SeoKeywords

	// 更新提供的字段
	if req.Title != "" {
		title = req.Title
	}
	if req.Slug != "" {
		if !isValidSlug(req.Slug) {
			return nil, ErrPostSlugInvalid
		}
		// 检查新 slug 是否与其他文章冲突
		if req.Slug != existing.Slug {
			_, err := s.queries.GetPostBySlug(ctx, req.Slug)
			if err == nil {
				return nil, ErrSlugExists
			} else if !errors.Is(err, sql.ErrNoRows) {
				return nil, fmt.Errorf("查询 slug 失败: %w", err)
			}
		}
		slug = req.Slug
	}
	if req.ContentMarkdown != "" {
		contentMd = req.ContentMarkdown
		html, err := s.renderMarkdown(req.ContentMarkdown)
		if err != nil {
			return nil, fmt.Errorf("渲染 Markdown 失败: %w", err)
		}
		contentHtml = html
	}
	if req.Excerpt != "" {
		excerpt = sql.NullString{String: req.Excerpt, Valid: true}
	}
	if req.CoverImage != "" {
		coverImage = sql.NullString{String: req.CoverImage, Valid: true}
	}
	if req.SEOTitle != "" {
		seoTitle = sql.NullString{String: req.SEOTitle, Valid: true}
	}
	if req.SEODescription != "" {
		seoDesc = sql.NullString{String: req.SEODescription, Valid: true}
	}
	if req.SEOKeywords != "" {
		seoKeywords = sql.NullString{String: req.SEOKeywords, Valid: true}
	}

	// 更新文章记录
	post, err := s.queries.UpdatePost(ctx, generated.UpdatePostParams{
		ID:             id,
		Title:          title,
		Slug:           slug,
		ContentMd:      contentMd,
		ContentHtml:    contentHtml,
		Excerpt:        excerpt,
		CoverImage:     coverImage,
		IsFeatured:     isFeatured,
		SeoTitle:       seoTitle,
		SeoDescription: seoDesc,
		SeoKeywords:    seoKeywords,
	})
	if err != nil {
		return nil, fmt.Errorf("更新文章失败: %w", err)
	}

	// 更新标签关联
	if len(req.TagIDs) > 0 {
		// 先删除旧的标签关联
		s.queries.DeletePostTags(ctx, id)
		// 再添加新的标签关联
		for _, tagID := range req.TagIDs {
			s.queries.CreatePostTag(ctx, generated.CreatePostTagParams{
				PostID: id,
				TagID:  tagID,
			})
		}
	}

	return post, nil
}

// DeletePost 删除文章
func (s *PostService) DeletePost(ctx context.Context, id uuid.UUID) error {
	_, err := s.queries.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrPostNotFound
		}
		return fmt.Errorf("查询文章失败: %w", err)
	}

	if err := s.queries.DeletePost(ctx, id); err != nil {
		return fmt.Errorf("删除文章失败: %w", err)
	}

	return nil
}

// UpdatePostStatus 更新文章状态
func (s *PostService) UpdatePostStatus(ctx context.Context, id uuid.UUID, status string) (*generated.Post, error) {
	if !validPostStatuses[status] {
		return nil, ErrInvalidStatus
	}

	post, err := s.queries.UpdatePostStatus(ctx, generated.UpdatePostStatusParams{
		ID:     id,
		Status: status,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, fmt.Errorf("更新文章状态失败: %w", err)
	}

	return post, nil
}

// IncrementViewCount 增加文章浏览次数
func (s *PostService) IncrementViewCount(ctx context.Context, id uuid.UUID) error {
	return s.queries.IncrementViewCount(ctx, id)
}

// AssociateTag 关联文章和标签
func (s *PostService) AssociateTag(ctx context.Context, postID uuid.UUID, tagID int32) error {
	_, err := s.queries.CreatePostTag(ctx, generated.CreatePostTagParams{
		PostID: postID,
		TagID:  tagID,
	})
	if err != nil {
		return fmt.Errorf("关联标签失败: %w", err)
	}
	return nil
}

// ReplacePostTags 替换文章的所有标签
func (s *PostService) ReplacePostTags(ctx context.Context, postID uuid.UUID, tagIDs []int32) error {
	// 先删除所有关联
	if err := s.queries.DeletePostTags(ctx, postID); err != nil {
		return fmt.Errorf("删除标签关联失败: %w", err)
	}

	// 重新关联
	for _, tagID := range tagIDs {
		if _, err := s.queries.CreatePostTag(ctx, generated.CreatePostTagParams{
			PostID: postID,
			TagID:  tagID,
		}); err != nil {
			return fmt.Errorf("关联标签失败: %w", err)
		}
	}

	return nil
}

// renderMarkdown 将 Markdown 渲染为 HTML
func (s *PostService) renderMarkdown(md string) (string, error) {
	var buf bytes.Buffer
	if err := s.md.Convert([]byte(md), &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// GenerateSlug 从标题生成 URL 友好的 slug
// 支持中文字符，将中文转为拼音或保留原字符
func GenerateSlug(title string) string {
	slug := strings.ToLower(title)

	// 将中文字符之间的空格替换为连字符
	slug = strings.ReplaceAll(slug, " ", "-")

	// 移除不合法的字符，只保留字母、数字、连字符和中文
	var result []rune
	prevDash := false
	for _, r := range slug {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || unicode.Is(unicode.Han, r) {
			if r == '-' {
				if !prevDash {
					result = append(result, r)
					prevDash = true
				}
			} else {
				result = append(result, r)
				prevDash = false
			}
		}
	}

	slug = strings.Trim(string(result), "-")

	// 如果 slug 为空，使用随机 ID
	if slug == "" {
		slug = "post-" + uuid.New().String()[:8]
	}

	return slug
}

// isValidSlug 验证 slug 格式是否合法
func isValidSlug(slug string) bool {
	if len(slug) == 0 || len(slug) > 255 {
		return false
	}
	// slug 只能包含小写字母、数字、连字符和中文字符
	pattern := `^[a-z0-9\-\p{Han}]+$`
	matched, _ := regexp.MatchString(pattern, slug)
	return matched
}
