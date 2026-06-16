// Package upload 定义文件上传聚合的领域模型。
//
// 文件上传支持分片上传、秒传（SHA-256 哈希去重）、断点续传。
// 包含两个聚合：File（已上传文件）和 UploadSession（上传会话）。
package upload

import (
	"regexp"
	"time"

	"blog-api/internal/domain/shared"
)

// 文件用途
const (
	PurposeAvatar   = "avatar"
	PurposePost     = "post"
	PurposeEmoji    = "emoji"
	PurposeMaterial = "material"
)

// 文件状态
const (
	StatusPending    = "pending"
	StatusProcessing = "processing"
	StatusReady      = "ready"
	StatusFailed     = "failed"
	StatusDeleted    = "deleted"
)

// 上传会话状态
const (
	SessionActive    = "active"
	SessionMerging   = "merging"
	SessionCompleted = "completed"
	SessionExpired   = "expired"
)

var purposePattern = regexp.MustCompile(`^(avatar|post|emoji|material)$`)

// IsValidPurpose 校验用途合法性
func IsValidPurpose(p string) bool { return purposePattern.MatchString(p) }

// ============================================================
// File 文件聚合根
// ============================================================

// File 已上传文件的聚合根
type File struct {
	shared.AggregateRoot
	id           shared.ID
	ownerID      shared.ID
	purpose      string
	originalName string
	path         string
	url          string
	size         int64
	mimeType     string
	fileHash     string // SHA-256
	width        *int
	height       *int
	thumbnail    string
	status       string
	refCount     int
	deletedAt    *time.Time
	timestamps   shared.Timestamps
}

// NewFile 创建新文件记录
func NewFile(id, ownerID shared.ID, purpose, originalName, path, url string, size int64, mimeType, fileHash string) (*File, error) {
	if !IsValidPurpose(purpose) {
		return nil, shared.BadRequest("无效的文件用途")
	}
	return &File{
		id: id, ownerID: ownerID, purpose: purpose,
		originalName: originalName, path: path, url: url,
		size: size, mimeType: mimeType, fileHash: fileHash,
		status: StatusReady, refCount: 0,
	}, nil
}

// ReconstructFile 从持久化数据重建
func ReconstructFile(id, ownerID shared.ID, purpose, originalName, path, url string, size int64, mimeType, fileHash string, width, height *int, thumbnail, status string, refCount int, deletedAt *time.Time, createdAt, updatedAt time.Time) *File {
	return &File{
		id: id, ownerID: ownerID, purpose: purpose,
		originalName: originalName, path: path, url: url,
		size: size, mimeType: mimeType, fileHash: fileHash,
		width: width, height: height, thumbnail: thumbnail,
		status: status, refCount: refCount, deletedAt: deletedAt,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// SetDimensions 设置图片尺寸
func (f *File) SetDimensions(width, height int) { w, h := width, height; f.width = &w; f.height = &h }

// SetThumbnail 设置缩略图
func (f *File) SetThumbnail(thumbnail string) { f.thumbnail = thumbnail }

// IncrementRef 引用计数 +1（防止物理删除被引用的文件）
func (f *File) IncrementRef() { f.refCount++ }

// DecrementRef 引用计数 -1
func (f *File) DecrementRef() {
	if f.refCount > 0 {
		f.refCount--
	}
}

// CanPhysicallyDelete 是否可物理删除（引用计数为 0 且未软删除）
func (f *File) CanPhysicallyDelete() bool { return f.refCount == 0 && f.deletedAt == nil }

// SoftDelete 软删除
func (f *File) SoftDelete() {
	now := time.Now()
	f.deletedAt = &now
	f.status = StatusDeleted
}

// MarkFailed 标记处理失败
func (f *File) MarkFailed() { f.status = StatusFailed }

// MarkProcessing 标记处理中
func (f *File) MarkProcessing() { f.status = StatusProcessing }

// MarkReady 标记就绪
func (f *File) MarkReady() { f.status = StatusReady }

// 访问器
func (f *File) ID() shared.ID         { return f.id }
func (f *File) OwnerID() shared.ID    { return f.ownerID }
func (f *File) Purpose() string       { return f.purpose }
func (f *File) OriginalName() string  { return f.originalName }
func (f *File) Path() string          { return f.path }
func (f *File) URL() string           { return f.url }
func (f *File) Size() int64           { return f.size }
func (f *File) MimeType() string      { return f.mimeType }
func (f *File) FileHash() string      { return f.fileHash }
func (f *File) Width() *int           { return f.width }
func (f *File) Height() *int          { return f.height }
func (f *File) Thumbnail() string     { return f.thumbnail }
func (f *File) Status() string        { return f.status }
func (f *File) RefCount() int         { return f.refCount }
func (f *File) DeletedAt() *time.Time { return f.deletedAt }
func (f *File) CreatedAt() time.Time  { return f.timestamps.CreatedAt }
func (f *File) UpdatedAt() time.Time  { return f.timestamps.UpdatedAt }

// ============================================================
// UploadSession 上传会话聚合根（分片上传）
// ============================================================

// UploadSession 分片上传会话
type UploadSession struct {
	shared.AggregateRoot
	id             shared.ID
	userID         shared.ID
	fileName       string
	fileSize       int64
	mimeType       string
	fileHash       string // SHA-256，用于秒传
	purpose        string
	chunkSize      int
	totalChunks    int
	uploadedChunks []int // 已完成分片索引
	status         string
	tmpPath        string
	expiresAt      time.Time
	timestamps     shared.Timestamps
}

// NewUploadSession 创建上传会话
func NewUploadSession(id, userID shared.ID, fileName string, fileSize int64, mimeType, fileHash, purpose string, chunkSize, totalChunks int) (*UploadSession, error) {
	if !IsValidPurpose(purpose) {
		return nil, shared.BadRequest("无效的文件用途")
	}
	return &UploadSession{
		id: id, userID: userID, fileName: fileName, fileSize: fileSize,
		mimeType: mimeType, fileHash: fileHash, purpose: purpose,
		chunkSize: chunkSize, totalChunks: totalChunks,
		uploadedChunks: []int{}, status: SessionActive,
		expiresAt: time.Now().Add(24 * time.Hour), // 24 小时过期
	}, nil
}

// ReconstructUploadSession 从持久化数据重建
func ReconstructUploadSession(id, userID shared.ID, fileName string, fileSize int64, mimeType, fileHash, purpose string, chunkSize, totalChunks int, uploadedChunks []int, status, tmpPath string, expiresAt time.Time, createdAt, updatedAt time.Time) *UploadSession {
	if uploadedChunks == nil {
		uploadedChunks = []int{}
	}
	return &UploadSession{
		id: id, userID: userID, fileName: fileName, fileSize: fileSize,
		mimeType: mimeType, fileHash: fileHash, purpose: purpose,
		chunkSize: chunkSize, totalChunks: totalChunks,
		uploadedChunks: uploadedChunks, status: status, tmpPath: tmpPath,
		expiresAt:  expiresAt,
		timestamps: shared.Timestamps{CreatedAt: createdAt, UpdatedAt: updatedAt},
	}
}

// MarkChunkUploaded 标记分片已上传
func (s *UploadSession) MarkChunkUploaded(index int) {
	for _, i := range s.uploadedChunks {
		if i == index {
			return // 幂等
		}
	}
	s.uploadedChunks = append(s.uploadedChunks, index)
}

// IsComplete 是否所有分片已上传
func (s *UploadSession) IsComplete() bool { return len(s.uploadedChunks) == s.totalChunks }

// IsExpired 是否已过期
func (s *UploadSession) IsExpired() bool { return time.Now().After(s.expiresAt) }

// StartMerge 开始合并
func (s *UploadSession) StartMerge(tmpPath string) { s.status = SessionMerging; s.tmpPath = tmpPath }

// Complete 合并完成
func (s *UploadSession) Complete() { s.status = SessionCompleted }

// Expire 标记过期
func (s *UploadSession) Expire() { s.status = SessionExpired }

// UploadedChunkCount 已上传分片数
func (s *UploadSession) UploadedChunkCount() int { return len(s.uploadedChunks) }

// 访问器
func (s *UploadSession) ID() shared.ID         { return s.id }
func (s *UploadSession) UserID() shared.ID     { return s.userID }
func (s *UploadSession) FileName() string      { return s.fileName }
func (s *UploadSession) FileSize() int64       { return s.fileSize }
func (s *UploadSession) MimeType() string      { return s.mimeType }
func (s *UploadSession) FileHash() string      { return s.fileHash }
func (s *UploadSession) Purpose() string       { return s.purpose }
func (s *UploadSession) ChunkSize() int        { return s.chunkSize }
func (s *UploadSession) TotalChunks() int      { return s.totalChunks }
func (s *UploadSession) UploadedChunks() []int { return s.uploadedChunks }
func (s *UploadSession) Status() string        { return s.status }
func (s *UploadSession) TmpPath() string       { return s.tmpPath }
func (s *UploadSession) ExpiresAt() time.Time  { return s.expiresAt }
func (s *UploadSession) CreatedAt() time.Time  { return s.timestamps.CreatedAt }
func (s *UploadSession) UpdatedAt() time.Time  { return s.timestamps.UpdatedAt }
