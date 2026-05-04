// Package model 定义应用的核心数据模型和类型
package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// FileStatus 文件状态类型
type FileStatus string

const (
	// FileStatusPending 待处理
	FileStatusPending FileStatus = "pending"
	// FileStatusProcessing 处理中（压缩、转码等）
	FileStatusProcessing FileStatus = "processing"
	// FileStatusReady 就绪，可正常访问
	FileStatusReady FileStatus = "ready"
	// FileStatusFailed 处理失败
	FileStatusFailed FileStatus = "failed"
	// FileStatusDeleted 已删除（软删除）
	FileStatusDeleted FileStatus = "deleted"
)

// File 文件记录，统一管理所有上传文件的生命周期
type File struct {
	// ID 文件唯一标识
	ID uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	// OwnerID 上传用户 ID
	OwnerID uuid.UUID `gorm:"type:uuid;not null;index" json:"ownerId"`
	// Purpose 文件用途：avatar|post|emoji|material，默认 material
	Purpose string `gorm:"column:purpose;size:20;not null;default:material" json:"purpose"`
	// OriginalName 原始文件名（仅展示用）
	OriginalName string `gorm:"size:255;not null" json:"originalName"`
	// Path 相对存储路径（内部使用，不对外暴露）
	Path string `gorm:"size:500;not null" json:"-"`
	// URL 访问地址
	URL string `gorm:"size:500;not null" json:"url"`
	// Size 文件大小（字节）
	Size int64 `gorm:"not null" json:"size"`
	// MimeType MIME 类型
	MimeType string `gorm:"size:100;not null" json:"mimeType"`
	// FileHash SHA-256 哈希，用于秒传去重
	FileHash string `gorm:"size:64;not null;index" json:"-"`
	// Width 图片宽度（px），非图片为 nil
	Width *int `json:"width,omitempty"`
	// Height 图片高度（px），非图片为 nil
	Height *int `json:"height,omitempty"`
	// Status 文件当前状态
	Status FileStatus `gorm:"size:20;not null;default:pending;index" json:"status"`
	// Thumbnail 缩略图 URL，图片和视频类型生成
	Thumbnail string `gorm:"size:500" json:"thumbnail,omitempty"`
	// RefCount 引用计数，大于 0 时禁止物理删除
	RefCount int `gorm:"not null;default:0" json:"-"`
	// DeletedAt 软删除时间戳，nil 表示未删除
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"createdAt"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (File) TableName() string { return "files" }

// SessionStatus 上传会话状态类型
type SessionStatus string

const (
	// SessionStatusActive 活跃，可继续上传分片
	SessionStatusActive SessionStatus = "active"
	// SessionStatusMerging 正在合并分片
	SessionStatusMerging SessionStatus = "merging"
	// SessionStatusCompleted 合并完成
	SessionStatusCompleted SessionStatus = "completed"
	// SessionStatusExpired 已过期
	SessionStatusExpired SessionStatus = "expired"
)

// UploadSession 分片上传会话，管理断点续传状态
type UploadSession struct {
	// ID 会话唯一标识（uploadId）
	ID uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"uploadId"`
	// UserID 上传用户 ID
	UserID uuid.UUID `gorm:"type:uuid;not null;index" json:"userId"`
	// FileName 原始文件名
	FileName string `gorm:"size:255;not null" json:"fileName"`
	// FileSize 文件总大小（字节）
	FileSize int64 `gorm:"not null" json:"fileSize"`
	// FileHash 文件 SHA-256 哈希，用于秒传和校验
	FileHash string `gorm:"size:64;not null;index" json:"fileHash"`
	// MimeType 文件 MIME 类型
	MimeType string `gorm:"size:100;not null" json:"mimeType"`
	// Purpose 文件用途：avatar|post|emoji|material，默认 material
	Purpose string `gorm:"column:purpose;size:20;not null;default:material" json:"purpose"`
	// ChunkSize 每个分片大小（字节），默认 5MB
	ChunkSize int `gorm:"not null;default:5242880" json:"chunkSize"`
	// TotalChunks 总分片数
	TotalChunks int `gorm:"not null" json:"totalChunks"`
	// UploadedChunks 已完成上传的分片索引，JSONB 数组 [0,1,2,...]
	UploadedChunks datatypes.JSONSlice[int] `gorm:"type:jsonb;not null" json:"uploadedChunks"`
	// Status 会话当前状态
	Status SessionStatus `gorm:"size:20;not null;default:active;index" json:"status"`
	// TmpPath 临时分片存储目录路径
	TmpPath string `gorm:"size:500;not null" json:"-"`
	// ExpiresAt 过期时间，创建后 24 小时
	ExpiresAt time.Time `gorm:"not null;index" json:"expiresAt"`
	// CreatedAt 创建时间
	CreatedAt time.Time `json:"createdAt"`
	// UpdatedAt 更新时间
	UpdatedAt time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (UploadSession) TableName() string { return "upload_sessions" }
