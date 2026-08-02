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

var purposePattern = regexp.MustCompile(`^(avatar|post|emoji|material|comment)$`)

// IsValidPurpose 校验用途合法性
func IsValidPurpose(p string) bool { return purposePattern.MatchString(p) }

// ============================================================
// File 文件聚合根
// ============================================================

// File 已上传文件的聚合根
type File struct {
	shared.AggregateRoot
	// id 文件唯一标识
	id shared.ID
	// ownerID 上传者用户 ID（隔离 owner 维度，秒传仅命中本人文件）
	ownerID shared.ID
	// purpose 文件用途分类（avatar/post/emoji/material/comment，由 purposePattern 校验）
	purpose string
	// originalName 用户上传时的原始文件名（可选重命名，见 UpdateMetadata）
	originalName string
	// path 物理存储路径（uploads/{purpose}/YYYY/MM/DD/HHMMSS.<uuid>.<ext>，由 ChunkStorage.BuildPath 生成）
	path string
	// url 对外访问 URL
	url string
	// size 文件大小（字节）
	size int64
	// mimeType MIME 类型
	mimeType string
	// fileHash 文件内容 SHA-256 哈希
	//
	// 秒传去重的依据：FindByHash 按它精确匹配，故 ReplaceStoredFile 覆盖原图后必须刷新为新 hash，
	// 否则会误命中被覆盖前的旧文件。
	fileHash string
	// width 图片宽度（指针，非图片为 nil；SetDimensions 写入）
	width *int
	// height 图片高度（指针，非图片为 nil；SetDimensions 写入）
	height *int
	// thumbnail 缩略图访问 URL（图片用 imaging、视频用 ffmpeg 生成，不支持时为空）
	thumbnail string
	// status 文件处理状态机（pending/processing/ready/failed/deleted）
	//
	// NewFile 落 ready；后处理流转 processing→ready/failed；SoftDelete 落 deleted。
	status string
	// refCount 引用计数（被文章/评论等引用 +1，解除 -1）
	//
	// 物理删除守卫：CanPhysicallyDelete 仅在 refCount==0 且未软删除时为真，
	// 防止删掉仍被业务引用的文件。
	refCount int
	// altText 图片替代文本/素材描述（无障碍 alt 属性 + SEO）
	altText string
	// category 用户自定义分类（与系统 purpose 正交，仅素材管理用）
	category string
	// deletedAt 软删除时间戳（nil 表示未删除；SoftDelete 写入，参与物理删除判定）
	deletedAt *time.Time
	// timestamps 创建/更新时间（ReconstructFile 从持久化层恢复，NewFile 自动取当前时间）
	timestamps shared.Timestamps
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
func ReconstructFile(id, ownerID shared.ID, purpose, originalName, path, url string, size int64, mimeType, fileHash string, width, height *int, thumbnail, status string, refCount int, altText, category string, deletedAt *time.Time, createdAt, updatedAt time.Time) *File {
	return &File{
		id: id, ownerID: ownerID, purpose: purpose,
		originalName: originalName, path: path, url: url,
		size: size, mimeType: mimeType, fileHash: fileHash,
		width: width, height: height, thumbnail: thumbnail,
		status: status, refCount: refCount, altText: altText, category: category,
		deletedAt:  deletedAt,
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

// UpdateMetadata 更新素材元数据（描述 + 自定义分类 + 文件名）
//
// altText 用于图片无障碍/SEO，category 是用户自定义分类（与系统 purpose 正交）。
// originalName 可选重命名（传空串则保持不变）。
func (f *File) UpdateMetadata(altText, category, originalName string) {
	f.altText = altText
	f.category = category
	if originalName != "" {
		f.originalName = originalName
	}
}

// ReplaceStoredFile 替换文件存储指针（覆盖原图）。
//
// 仅在 owner 校验通过后由 service 调用。fileHash 用新文件 SHA-256，
// 保证后续秒传按新 hash 查询准确，不会误命中被覆盖前的旧文件。
// 旧物理文件由 service 决定保留（可能被其他记录引用）。
// id/owner/purpose/refCount/originalName 等字段不触碰。
func (f *File) ReplaceStoredFile(path, url string, size int64, mimeType, fileHash string, width, height *int, thumbnail string) {
	f.path = path
	f.url = url
	f.size = size
	f.mimeType = mimeType
	f.fileHash = fileHash
	f.width = width
	f.height = height
	f.thumbnail = thumbnail
}

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
func (f *File) AltText() string       { return f.altText }
func (f *File) Category() string      { return f.category }
func (f *File) DeletedAt() *time.Time { return f.deletedAt }
func (f *File) CreatedAt() time.Time  { return f.timestamps.CreatedAt }
func (f *File) UpdatedAt() time.Time  { return f.timestamps.UpdatedAt }

// ============================================================
// UploadSession 上传会话聚合根（分片上传）
// ============================================================

// UploadSession 分片上传会话
type UploadSession struct {
	shared.AggregateRoot
	// id 会话唯一标识
	id shared.ID
	// userID 发起上传的用户 ID（FindByHash 按它匹配本人历史会话，实现断点续传）
	userID shared.ID
	// fileName 目标文件名
	fileName string
	// fileSize 待上传文件总大小（字节）
	fileSize int64
	// mimeType 文件 MIME 类型
	mimeType string
	// fileHash 目标文件 SHA-256
	//
	// 用于断点续传（FindByHash 命中未完成会话）与秒传（命中已完成会话直接复用文件）。
	fileHash string
	// purpose 文件用途分类（同 File.Purpose，由 purposePattern 校验）
	purpose string
	// chunkSize 单个分片大小（字节）
	chunkSize int
	// totalChunks 文件被切分的总分片数（IsComplete 据此与 len(uploadedChunks) 比较）
	totalChunks int
	// uploadedChunks 已上传完成的分片索引集合
	//
	// MarkChunkUploaded 幂等追加（重复索引直接跳过）；len 与 totalChunks 相等即上传完成。
	uploadedChunks []int
	// status 会话状态机（active/merging/completed/expired）
	//
	// active→merging（StartMerge，写入 tmpPath）→completed（Complete）；
	// 超时则 active→expired（Expire）。UpdateStatus 以 CAS 保证并发安全。
	status string
	// tmpPath 合并阶段的临时目录路径（StartMerge 时写入，合并完成后清理）
	tmpPath string
	// expiresAt 会话过期时间（NewUploadSession 设为创建时刻 +24 小时，IsExpired 据此判定）
	expiresAt time.Time
	// timestamps 创建/更新时间（每次状态变更刷新 UpdatedAt）
	timestamps shared.Timestamps
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
