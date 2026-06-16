package announcement

import (
	"context"

	"blog-api/internal/domain/shared"
)

// AnnouncementRepository 公告仓储接口
type AnnouncementRepository interface {
	FindByID(ctx context.Context, id int32) (*Announcement, error)
	FindAll(ctx context.Context) ([]*Announcement, error)
	FindActive(ctx context.Context) ([]*Announcement, error)
	Save(ctx context.Context, a *Announcement) (int32, error)
	Delete(ctx context.Context, id int32) error
}

var (
	ErrNotFound = shared.NotFound("公告")
)
