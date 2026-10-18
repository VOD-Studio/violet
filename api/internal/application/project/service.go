// Package project 提供 application 层用例（简化 DDD，CRUD 合一）。
package project

import (
	"context"
	"errors"
	"strconv"
	"time"

	domain "blog-api/internal/domain/project"
	domainshared "blog-api/internal/domain/shared"
)

// ProjectDTO 项目读模型
type ProjectDTO struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	URL         string   `json:"url"`
	GithubURL   string   `json:"github_url"`
	ImageURL    string   `json:"image_url"`
	TechStack   []string `json:"tech_stack"`
	SortOrder   int      `json:"sort_order"`
	CreatedAt   string   `json:"created_at"`
	// Roadmap 仅项目列表附带；详情接口使用独立的路线图读模型。
	Roadmap *RoadmapSummaryDTO `json:"roadmap,omitempty"`
}

// Service 项目用例服务
type Service struct {
	repo      domain.ProjectRepository
	summaries RoadmapSummaryReader
}

// NewService 构造项目用例服务
func NewService(repo domain.ProjectRepository) *Service {
	return &Service{repo: repo}
}

// WithRoadmapSummaries 在构造时配置列表摘要读取，不参与运行时配置切换。
func (s *Service) WithRoadmapSummaries(reader RoadmapSummaryReader) *Service {
	s.summaries = reader
	return s
}

// List 获取所有项目
func (s *Service) List(ctx context.Context) ([]ProjectDTO, error) {
	items, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	return s.listDTOs(ctx, items)
}

// ListPage 分页获取项目
func (s *Service) ListPage(ctx context.Context, q domainshared.PageQuery) (domainshared.PageResult[ProjectDTO], error) {
	result, err := s.repo.FindPage(ctx, q)
	if err != nil {
		return domainshared.PageResult[ProjectDTO]{}, err
	}
	dtos, err := s.listDTOs(ctx, result.Items)
	if err != nil {
		return domainshared.PageResult[ProjectDTO]{}, err
	}
	return domainshared.NewPageResult(domainshared.PageQuery{Page: result.Page, Limit: result.Limit}, dtos, result.Total), nil
}

func (s *Service) listDTOs(ctx context.Context, projects []*domain.Project) ([]ProjectDTO, error) {
	dtos := make([]ProjectDTO, 0, len(projects))
	ids := make([]domainshared.ID, 0, len(projects))
	for _, p := range projects {
		dtos = append(dtos, ToDTO(p))
		ids = append(ids, p.ID())
	}
	if s.summaries == nil || len(projects) == 0 {
		return dtos, nil
	}
	summaries, err := s.summaries.ReadSummaries(ctx, ids)
	if err != nil {
		return nil, err
	}
	for index, id := range ids {
		summary := summaries[id]
		if summary.InProgress == nil {
			summary.InProgress = []RoadmapItemPreviewDTO{}
		}
		dtos[index].Roadmap = &summary
	}
	return dtos, nil
}

// Get 按 ID 获取项目详情
func (s *Service) Get(ctx context.Context, id string) (ProjectDTO, error) {
	pid, err := parseID(id)
	if err != nil {
		return ProjectDTO{}, err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return ProjectDTO{}, err
	}
	return ToDTO(p), nil
}

func (s *Service) GetBySlug(ctx context.Context, slug string) (ProjectDTO, error) {
	if !domain.IsValidSlug(slug) {
		return ProjectDTO{}, domain.ErrNotFound
	}
	p, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return ProjectDTO{}, err
	}
	return ToDTO(p), nil
}

// CreateInput 创建项目入参
type CreateInput struct {
	Title       string
	Slug        string // 空串按标题生成，冲突时追加数字后缀
	Description string
	URL         string
	GithubURL   string
	ImageURL    string
	TechStack   []string
	SortOrder   int
}

// Create 创建项目
func (s *Service) Create(ctx context.Context, in CreateInput) error {
	p, err := domain.NewProject(newID(), in.Title, in.Description)
	if err != nil {
		return err
	}
	slug := in.Slug
	if slug == "" {
		slug, err = s.availableSlug(ctx, p.Slug())
	} else {
		err = s.checkSlug(ctx, slug, p.ID())
	}
	if err != nil {
		return err
	}
	if err := p.SetSlug(slug); err != nil {
		return err
	}
	if err := p.Update(in.Title, in.Description, in.URL, in.GithubURL, in.ImageURL); err != nil {
		return err
	}
	p.SetTechStack(in.TechStack)
	p.SetSortOrder(in.SortOrder)
	return s.repo.Save(ctx, p)
}

// UpdateInput 更新项目入参
type UpdateInput struct {
	Title       string
	Slug        *string // nil 保留原值；显式空串非法
	Description string
	URL         string
	GithubURL   string
	ImageURL    string
	TechStack   []string
	SortOrder   int
}

// Update 更新项目
func (s *Service) Update(ctx context.Context, id string, in UpdateInput) error {
	pid, err := parseID(id)
	if err != nil {
		return err
	}
	p, err := s.repo.FindByID(ctx, pid)
	if err != nil {
		return err
	}
	if in.Slug != nil && *in.Slug != p.Slug() {
		if err := s.checkSlug(ctx, *in.Slug, p.ID()); err != nil {
			return err
		}
	}
	if err := p.Update(in.Title, in.Description, in.URL, in.GithubURL, in.ImageURL); err != nil {
		return err
	}
	if in.Slug != nil {
		if err := p.SetSlug(*in.Slug); err != nil {
			return err
		}
	}
	p.SetTechStack(in.TechStack)
	p.SetSortOrder(in.SortOrder)
	return s.repo.Save(ctx, p)
}

func (s *Service) checkSlug(ctx context.Context, slug string, except domainshared.ID) error {
	if !domain.IsValidSlug(slug) {
		return domainshared.BadRequest("项目 slug 格式不合法")
	}
	existing, err := s.repo.FindBySlug(ctx, slug)
	if errors.Is(err, domain.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if existing.ID() != except {
		return domain.ErrSlugConflict
	}
	return nil
}

func (s *Service) availableSlug(ctx context.Context, base string) (string, error) {
	for suffix := 1; ; suffix++ {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		candidate := base
		if suffix > 1 {
			candidate += "-" + strconv.Itoa(suffix)
		}
		_, err := s.repo.FindBySlug(ctx, candidate)
		if errors.Is(err, domain.ErrNotFound) {
			return candidate, nil
		}
		if err != nil {
			return "", err
		}
	}
}

// Delete 删除项目
func (s *Service) Delete(ctx context.Context, id string) error {
	pid, err := parseID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, pid)
}

// ToDTO 返回公开项目字段与 RFC3339 格式的创建时间。
func ToDTO(p *domain.Project) ProjectDTO {
	return ProjectDTO{
		ID: p.ID().String(), Title: p.Title(), Slug: p.Slug(), Description: p.Description(),
		URL: p.URL(), GithubURL: p.GithubURL(), ImageURL: p.ImageURL(),
		TechStack: p.TechStack(), SortOrder: p.SortOrder(),
		CreatedAt: p.CreatedAt().Format(time.RFC3339),
	}
}
