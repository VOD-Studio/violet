package upload

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// FileRepository 文件仓储接口
type FileRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*File, error)
	// FindByHash 秒传检查:仅命中该 owner 自己上传过的文件,防越权秒传他人文件
	FindByHash(ctx context.Context, hash string, ownerID shared.ID) (*File, error)
	// FindByURLs 按访问 URL 批量查找就绪（status=ready）文件。
	// 推文发布归属校验用（TweetImageChecker）：命中数少于传入数即有 URL 不存在/未就绪。
	FindByURLs(ctx context.Context, urls []string) ([]*File, error)
	// FindByIDs 按 ID 批量查找文件（不限状态，软删文件也返回——详情渲染兜底展示）。
	// 图集详情/列表组装用（GalleryMediaChecker）：一次 IN 查询，量级 ≤50。
	FindByIDs(ctx context.Context, ids []shared.ID) ([]*File, error)
	// FindPage 分页列出文件（统一入口，筛选维度由 FileListFilter 正交组合）。
	// 排序 created_at DESC + id DESC tiebreaker（id 为 UUID），防 offset 翻页漂移。
	FindPage(ctx context.Context, filter FileListFilter, q shared.PageQuery) (shared.PageResult[*File], error)
	Save(ctx context.Context, f *File) error
	Delete(ctx context.Context, id shared.ID) error
	UpdateRefCount(ctx context.Context, id shared.ID, delta int) error
}

// FileListFilter 文件列表筛选条件（FindPage 入参，维度正交组合）。
//
// 用户素材列表传 OwnerID（可叠加 Purpose）；后台全局管理不传 OwnerID，
// 另可叠加 category/mimePrefix/keyword。所有字段可选，传零值表示不过滤。
type FileListFilter struct {
	// OwnerID 只列该用户上传的文件；nil = 全站（后台素材管理视角）
	OwnerID *shared.ID
	// 用途分类筛选（material/avatar/post/emoji），空则全部
	Purpose string
	// 自定义分类筛选，空则全部
	Category string
	// MIME 类型前缀筛选（如 image/、video/），空则全部
	MimePrefix string
	// 关键词搜索（匹配 original_name），空则不搜索
	Keyword string
	// 是否包含已软删除的文件，默认 false
	IncludeDeleted bool
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
	// 返回 error：purpose 含 ".." 等穿越片段时拒绝。
	// BuildPath 按 purpose + 时间戳生成日期分目录路径:
	// uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>
	BuildPath(purpose string, timestamp time.Time, fileUUID, ext string) (path, url string, err error)
}
