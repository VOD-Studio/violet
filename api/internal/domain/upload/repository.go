package upload

import (
	"context"

	"blog-api/internal/domain/shared"
)

// FileRepository 文件仓储接口
type FileRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*File, error)
	FindByHash(ctx context.Context, hash string) (*File, error) // 秒传检查
	FindByOwner(ctx context.Context, ownerID shared.ID, purpose string, page, limit int) ([]*File, int64, error)
	Save(ctx context.Context, f *File) error
	Delete(ctx context.Context, id shared.ID) error
	UpdateRefCount(ctx context.Context, id shared.ID, delta int) error
}

// UploadSessionRepository 上传会话仓储接口
type UploadSessionRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*UploadSession, error)
	FindByHash(ctx context.Context, hash string, userID shared.ID) (*UploadSession, error) // 断点续传
	Save(ctx context.Context, s *UploadSession) error
	Delete(ctx context.Context, id shared.ID) error
	DeleteExpired(ctx context.Context) error
}

// 领域错误
var (
	ErrFileNotFound      = shared.NotFound("文件")
	ErrSessionNotFound   = shared.NotFound("上传会话")
	ErrFileInUse         = shared.Conflict("文件正在被引用，无法删除")
	ErrSessionExpired    = shared.BadRequest("上传会话已过期")
	ErrChunkIndexInvalid = shared.BadRequest("无效的分片索引")
)
