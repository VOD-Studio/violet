// Package project 提供 application 层用例（简化 DDD，CRUD 合一）。
package project

import (
	"context"
	"time"

	domain "blog-api/internal/domain/project"
)

// ProjectDTO 项目读模型
type ProjectDTO struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	URL         string   `json:"url"`
	GithubURL   string   `json:"github_url"`
	ImageURL    string   `json:"image_url"`
	TechStack   []string `json:"tech_stack"`
	SortOrder   int      `json:"sort_order"`
	CreatedAt   string   `json:"created_at"`
}

// Service 项目用例服务
type Service struct {
	repo domain.ProjectRepository
}

// NewService 构造项目用例服务
func NewService(repo domain.ProjectRepository) *Service {
	return &Service{repo: repo}
}

// List 获取所有项目
func (s *Service) List(ctx context.Context) ([]ProjectDTO, error) {
	items, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	dtos := make([]ProjectDTO, 0, len(items))
	for _, p := range items {
		dtos = append(dtos, toDTO(p))
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
	return toDTO(p), nil
}

// CreateInput 创建项目入参
type CreateInput struct {
	Title       string
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
	if err := p.Update(in.Title, in.Description, in.URL, in.GithubURL, in.ImageURL); err != nil {
		return err
	}
	p.SetTechStack(in.TechStack)
	p.SetSortOrder(in.SortOrder)
	return s.repo.Save(ctx, p)
}

// Delete 删除项目
func (s *Service) Delete(ctx context.Context, id string) error {
	pid, err := parseID(id)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, pid)
}

func toDTO(p *domain.Project) ProjectDTO {
	return ProjectDTO{
		ID: p.ID().String(), Title: p.Title(), Description: p.Description(),
		URL: p.URL(), GithubURL: p.GithubURL(), ImageURL: p.ImageURL(),
		TechStack: p.TechStack(), SortOrder: p.SortOrder(),
		CreatedAt: p.CreatedAt().Format(time.RFC3339),
	}
}
