package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"blog-api/internal/repository/generated"
)

// 项目相关错误定义
var (
	ErrProjectNotFound = errors.New("项目不存在")
)

// ProjectService 项目业务服务
type ProjectService struct {
	queries *generated.Queries
}

// NewProjectService 创建项目服务实例
func NewProjectService(queries *generated.Queries) *ProjectService {
	return &ProjectService{
		queries: queries,
	}
}

// ListProjects 获取项目列表
func (s *ProjectService) ListProjects(ctx context.Context) ([]*generated.Project, error) {
	projects, err := s.queries.ListProjects(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询项目列表失败: %w", err)
	}
	return projects, nil
}

// GetProjectByID 按 ID 获取项目详情
func (s *ProjectService) GetProjectByID(ctx context.Context, id uuid.UUID) (*generated.Project, error) {
	project, err := s.queries.GetProjectByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProjectNotFound
		}
		return nil, fmt.Errorf("查询项目失败: %w", err)
	}
	return project, nil
}

// CreateProject 创建项目
func (s *ProjectService) CreateProject(ctx context.Context, req CreateProjectRequest) (*generated.Project, error) {
	log.Info().Str("service", "ProjectService").Str("operation", "CreateProject").
		Str("title", req.Title).Msg("开始创建项目")

	description := sql.NullString{}
	if req.Description != "" {
		description = sql.NullString{String: req.Description, Valid: true}
	}

	url := sql.NullString{}
	if req.URL != "" {
		url = sql.NullString{String: req.URL, Valid: true}
	}

	githubURL := sql.NullString{}
	if req.GithubURL != "" {
		githubURL = sql.NullString{String: req.GithubURL, Valid: true}
	}

	imageURL := sql.NullString{}
	if req.ImageURL != "" {
		imageURL = sql.NullString{String: req.ImageURL, Valid: true}
	}

	techStack := req.TechStack
	if techStack == nil {
		techStack = []string{}
	}

	log.Debug().Str("query", "CreateProject").Str("title", req.Title).Msg("创建项目记录")
	project, err := s.queries.CreateProject(ctx, generated.CreateProjectParams{
		Title:       req.Title,
		Description: description,
		Url:         url,
		GithubUrl:   githubURL,
		ImageUrl:    imageURL,
		TechStack:   techStack,
		SortOrder:   int32(req.SortOrder),
	})
	if err != nil {
		log.Error().Err(err).Str("title", req.Title).Msg("创建项目失败")
		return nil, fmt.Errorf("创建项目失败: %w", err)
	}

	log.Info().Str("project_id", project.ID.String()).Str("title", req.Title).Msg("项目创建成功")
	return project, nil
}

// UpdateProject 更新项目
func (s *ProjectService) UpdateProject(ctx context.Context, id uuid.UUID, req UpdateProjectRequest) (*generated.Project, error) {
	// 查询现有项目
	existing, err := s.queries.GetProjectByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrProjectNotFound
		}
		return nil, fmt.Errorf("查询项目失败: %w", err)
	}

	// 使用现有值作为默认值
	title := existing.Title
	description := existing.Description
	url := existing.Url
	githubURL := existing.GithubUrl
	imageURL := existing.ImageUrl
	techStack := existing.TechStack
	sortOrder := existing.SortOrder

	// 更新提供的字段
	if req.Title != "" {
		title = req.Title
	}
	if req.Description != "" {
		description = sql.NullString{String: req.Description, Valid: true}
	}
	if req.URL != "" {
		url = sql.NullString{String: req.URL, Valid: true}
	}
	if req.GithubURL != "" {
		githubURL = sql.NullString{String: req.GithubURL, Valid: true}
	}
	if req.ImageURL != "" {
		imageURL = sql.NullString{String: req.ImageURL, Valid: true}
	}
	if req.TechStack != nil {
		techStack = req.TechStack
	}
	if req.SortOrder != 0 {
		sortOrder = int32(req.SortOrder)
	}

	project, err := s.queries.UpdateProject(ctx, generated.UpdateProjectParams{
		ID:          id,
		Title:       title,
		Description: description,
		Url:         url,
		GithubUrl:   githubURL,
		ImageUrl:    imageURL,
		TechStack:   techStack,
		SortOrder:   sortOrder,
	})
	if err != nil {
		return nil, fmt.Errorf("更新项目失败: %w", err)
	}

	return project, nil
}

// DeleteProject 删除项目
func (s *ProjectService) DeleteProject(ctx context.Context, id uuid.UUID) error {
	_, err := s.queries.GetProjectByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrProjectNotFound
		}
		return fmt.Errorf("查询项目失败: %w", err)
	}

	if err := s.queries.DeleteProject(ctx, id); err != nil {
		return fmt.Errorf("删除项目失败: %w", err)
	}

	return nil
}
