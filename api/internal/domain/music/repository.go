package music

import (
	"context"

	"blog-api/internal/domain/shared"
)

// PlaylistRepository 歌单仓储接口
type PlaylistRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Playlist, error)
	FindActive(ctx context.Context) ([]*Playlist, error)
	FindAll(ctx context.Context) ([]*Playlist, error)
	Save(ctx context.Context, p *Playlist) error
	Delete(ctx context.Context, id shared.ID) error
}

var ErrNotFound = shared.NotFound("歌单")
