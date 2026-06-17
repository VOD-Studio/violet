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
	// UpdateStatus 更新会话状态（CAS：仅当旧状态匹配时更新，返回是否成功）
	UpdateStatus(ctx context.Context, id shared.ID, oldStatus, newStatus string) (bool, error)
	// AppendChunk 追加已上传分片索引（事务安全）
	AppendChunk(ctx context.Context, id shared.ID, index int) error
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
	ErrSessionNotActive  = shared.BadRequest("上传会话不在活跃状态")
	ErrUploadIncomplete  = shared.BadRequest("分片上传未完成")
)

// ChunkStorage 分片文件存储端口（infrastructure 层实现）
//
// 封装文件系统操作：分片读写、合并、缩略图生成。
// domain 层定义端口，application 层依赖端口，infrastructure 层提供实现。
type ChunkStorage interface {
	// EnsureDir 确保目录存在
	EnsureDir(dir string) error
	// SaveChunk 保存单个分片到 chunkDir/chunk_NNNN
	SaveChunk(chunkDir string, index int, data []byte) error
	// ReadChunk 读取分片内容
	ReadChunk(chunkDir string, index int) ([]byte, error)
	// MergeChunks 按 index 顺序合并所有分片到 destPath
	MergeChunks(chunkDir string, totalChunks int, destPath string) error
	// CleanupDir 清理目录
	CleanupDir(dir string) error
	// FileSize 获取文件大小
	FileSize(path string) (int64, error)
	// Move 移动文件
	Move(src, dst string) error
	// ImageDimensions 获取图片宽高（非图片返回 0,0）
	ImageDimensions(path string) (width, height int)
	// GenerateThumbnail 生成缩略图（图片用 imaging，视频用 ffmpeg），返回 URL；不支持时返回空
	GenerateThumbnail(srcPath, fileUUID, storageDir, mimeType string) string
	// BuildPath 构建最终文件存储路径与访问 URL
	BuildPath(purpose, mimeType string, fileUUID, ext string) (path, url string)
}
