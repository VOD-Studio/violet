package project

import (
	"context"

	"blog-api/internal/domain/shared"
)

// ProjectRepository 项目仓储接口
type ProjectRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Project, error)
	FindAll(ctx context.Context) ([]*Project, error)
	Save(ctx context.Context, p *Project) error
	Delete(ctx context.Context, id shared.ID) error
}

var (
	ErrNotFound = shared.NotFound("项目")
)
