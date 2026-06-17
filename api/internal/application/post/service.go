// Package post 提供 application 层用例。
package post

import (
	"context"
	"time"

	domain "blog-api/internal/domain/post"
	"blog-api/internal/domain/shared"
)

// PostDTO 文章读模型
type PostDTO struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Slug           string   `json:"slug"`
	ContentMD      string   `json:"content_md"`
	ContentHTML    string   `json:"content_html"`
	Excerpt        string   `json:"excerpt"`
	CoverImage     string   `json:"cover_image"`
	Status         string   `json:"status"`
	AuthorID       string   `json:"author_id"`
	ViewCount      int      `json:"view_count"`
	IsFeatured     bool     `json:"is_featured"`
	SEOTitle       string   `json:"seo_title"`
	SEODescription string   `json:"seo_description"`
	PublishedAt    string   `json:"published_at,omitempty"`
	Tags           []string `json:"tags"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
}

// Service 文章用例服务
type Service struct {
	repo domain.PostRepository
}

// NewService 构造文章用例服务
func NewService(repo domain.PostRepository) *Service {
	return &Service{repo: repo}
}

// GetBySlug 按 slug 获取已发布文章
func (s *Service) GetBySlug(ctx context.Context, slug string) (PostDTO, error) {
	p, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// GetByID 按 ID 获取文章（后台）
func (s *Service) GetByID(ctx context.Context, id string) (PostDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// ListPublished 列出已发布文章（前台）
func (s *Service) ListPublished(ctx context.Context, page, limit int, tag string) ([]PostDTO, int64, error) {
	items, total, err := s.repo.FindPublished(ctx, page, limit, tag)
	if err != nil {
		return nil, 0, err
	}
	return toDTOs(items), total, nil
}

// ListAll 列出所有文章（后台）
func (s *Service) ListAll(ctx context.Context, page, limit int, status string) ([]PostDTO, int64, error) {
	items, total, err := s.repo.FindAll(ctx, page, limit, status)
	if err != nil {
		return nil, 0, err
	}
	return toDTOs(items), total, nil
}

// CreateInput 创建文章入参
type CreateInput struct {
	AuthorID       string
	Title          string
	Slug           string
	ContentMD      string
	ContentHTML    string
	Excerpt        string
	CoverImage     string
	SEOTitle       string
	SEODescription string
	Tags           []string
}

// Create 创建文章
func (s *Service) Create(ctx context.Context, in CreateInput) (PostDTO, error) {
	authorID, err := shared.ParseID(in.AuthorID)
	if err != nil {
		return PostDTO{}, err
	}
	p, err := domain.NewPost(shared.NewID(), authorID, in.Title, in.Slug)
	if err != nil {
		return PostDTO{}, err
	}
	// slug 查重
	exists, err := s.repo.ExistsBySlug(ctx, in.Slug)
	if err != nil {
		return PostDTO{}, err
	}
	if exists {
		return PostDTO{}, domain.ErrSlugConflict
	}
	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return PostDTO{}, err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// UpdateInput 更新文章入参
type UpdateInput struct {
	ID             string
	Title          string
	Slug           string
	ContentMD      string
	ContentHTML    string
	Excerpt        string
	CoverImage     string
	SEOTitle       string
	SEODescription string
	Tags           []string
}

// Update 更新文章
func (s *Service) Update(ctx context.Context, in UpdateInput) error {
	pid, err := shared.ParseID(in.ID)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	if in.Slug != "" && in.Slug != p.Slug() {
		exists, err := s.repo.ExistsBySlug(ctx, in.Slug)
		if err != nil {
			return err
		}
		if exists {
			return domain.ErrSlugConflict
		}
		if err := p.UpdateSlug(in.Slug); err != nil {
			return err
		}
	}
	if err := p.UpdateContent(in.Title, in.ContentMD, in.ContentHTML, in.Excerpt, in.CoverImage); err != nil {
		return err
	}
	p.UpdateSEO(in.SEOTitle, in.SEODescription)
	p.SetTags(in.Tags)
	return s.repo.Save(ctx, p)
}

// Publish 发布文章
func (s *Service) Publish(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	p.Publish()
	return s.repo.Save(ctx, p)
}

// UpdateStatus 更新文章状态（draft/published/archived）
//
// 根据状态调用对应聚合根状态机方法，保证 published_at 等不变量一致。
func (s *Service) UpdateStatus(ctx context.Context, id, status string) (PostDTO, error) {
	pid, err := shared.ParseID(id)
	if err != nil {
		return PostDTO{}, err
	}
	if !domain.IsValidStatus(status) {
		return PostDTO{}, shared.BadRequest("无效的文章状态")
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return PostDTO{}, err
	}
	switch status {
	case domain.StatusPublished:
		p.Publish()
	case domain.StatusArchived:
		p.Archive()
	case domain.StatusDraft:
		p.RevertToDraft()
	}
	if err := s.repo.Save(ctx, p); err != nil {
		return PostDTO{}, err
	}
	return toDTO(p), nil
}

// IncrementView 浏览量 +1（含浏览事件记录，供 admin 趋势统计）
func (s *Service) IncrementView(ctx context.Context, id, ipAddress, userAgent string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	p.IncrementView()
	if err := s.repo.Save(ctx, p); err != nil {
		return err
	}
	return s.repo.RecordView(ctx, pid, ipAddress, userAgent)
}

// Delete 删除文章
func (s *Service) Delete(ctx context.Context, id string) error {
	pid, err := shared.ParseID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, pid)
}

func toDTO(p *domain.Post) PostDTO {
	dto := PostDTO{
		ID: p.ID().String(), Title: p.Title(), Slug: p.Slug(),
		ContentMD: p.ContentMD(), ContentHTML: p.ContentHTML(),
		Excerpt: p.Excerpt(), CoverImage: p.CoverImage(),
		Status: p.Status(), AuthorID: p.AuthorID().String(),
		ViewCount: p.ViewCount(), IsFeatured: p.IsFeatured(),
		SEOTitle: p.SEOTitle(), SEODescription: p.SEODescription(),
		Tags:      p.Tags(),
		CreatedAt: p.CreatedAt().Format(time.RFC3339),
		UpdatedAt: p.UpdatedAt().Format(time.RFC3339),
	}
	if p.PublishedAt() != nil {
		dto.PublishedAt = p.PublishedAt().Format(time.RFC3339)
	}
	return dto
}

func toDTOs(items []*domain.Post) []PostDTO {
	dtos := make([]PostDTO, 0, len(items))
	for _, p := range items {
		dtos = append(dtos, toDTO(p))
	}
	return dtos
}
