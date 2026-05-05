// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/internal/model"

	"gorm.io/datatypes"
)

// 分片上传相关错误定义
var (
	// ErrUploadNotFound 上传任务不存在
	ErrUploadNotFound = errors.New("上传任务不存在")
	// ErrUploadIncomplete 上传任务未完成
	ErrUploadIncomplete = errors.New("分片上传未完成")
	// ErrHashMismatch 文件哈希校验失败
	ErrHashMismatch = errors.New("文件哈希校验失败")
	// ErrSessionNotActive 上传会话不在活跃状态
	ErrSessionNotActive = errors.New("上传会话不在活跃状态")
	// ErrChunkAlreadyExists 分片已存在
	ErrChunkAlreadyExists = errors.New("分片已存在")
	// ErrInvalidImageType 不支持的文件类型
	ErrInvalidImageType = errors.New("不支持的文件类型")
	// ErrImageTooLarge 文件过大
	ErrImageTooLarge = errors.New("文件过大")
	// ErrInvalidPurpose 不支持的上传用途
	ErrInvalidPurpose = errors.New("不支持的上传用途")
)

// 允许的上传用途白名单
var allowedPurposes = []string{
	"avatar",   // 用户头像
	"post",     // 文章封面/内容图片
	"material", // 素材库（默认）
	"comment",  // 评论图片
}

// 支持的文件类型扩展名到 MIME 类型的映射
var allowedUploadTypes = map[string]string{
	// 图片
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".svg":  "image/svg+xml",
	// 视频
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".mov":  "video/quicktime",
	".avi":  "video/x-msvideo",
	".mkv":  "video/x-matroska",
	// 音频
	".mp3":  "audio/mpeg",
	".wav":  "audio/wav",
	".ogg":  "audio/ogg",
	".flac": "audio/flac",
	".aac":  "audio/aac",
	// 文档
	".pdf":  "application/pdf",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xls":  "application/vnd.ms-excel",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".ppt":  "application/vnd.ms-powerpoint",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".zip":  "application/zip",
	".rar":  "application/vnd.rar",
	".7z":   "application/x-7z-compressed",
	".md":   "text/markdown",
}

// UploadService 分片上传业务服务
type UploadService struct {
	db          *gorm.DB            // GORM 数据库实例
	fileSvc     *FileService        // 文件管理服务
	storageSvc  *FileStorageService // 文件存储服务
	chunkDir    string              // 临时分片目录，如 "uploads/tmp"
	uploadDir   string              // 最终文件目录，如 "uploads"
	maxFileSize int64               // 最大文件大小（字节）
}

// NewUploadService 创建分片上传服务实例
func NewUploadService(db *gorm.DB, fileSvc *FileService, chunkDir, uploadDir, urlPrefix string, maxFileSize int64) *UploadService {
	return &UploadService{
		db:          db,
		fileSvc:     fileSvc,
		storageSvc:  NewFileStorageService(uploadDir, urlPrefix),
		chunkDir:    chunkDir,
		uploadDir:   uploadDir,
		maxFileSize: maxFileSize,
	}
}

// InitSessionRequest 初始化上传会话请求
type InitSessionRequest struct {
	// FileName 原始文件名
	FileName string `json:"fileName"`
	// FileSize 文件总大小（字节）
	FileSize int64 `json:"fileSize"`
	// FileHash 文件 MD5 哈希
	FileHash string `json:"fileHash"`
	// MimeType 文件 MIME 类型
	MimeType string `json:"mimeType"`
	// ChunkSize 每个分片大小（字节）
	ChunkSize int `json:"chunkSize"`
	// FileType 文件用途：avatar|post|material，默认 material
	Purpose string `json:"purpose"`
}

// InitSessionResponse 初始化上传会话响应
type InitSessionResponse struct {
	// Instant 是否秒传命中
	Instant bool `json:"instant"`
	// FileID 秒传命中的文件 ID
	FileID string `json:"fileId,omitempty"`
	// URL 秒传命中的文件 URL
	URL string `json:"url,omitempty"`
	// UploadID 新建或续传的会话 ID
	UploadID string `json:"uploadId,omitempty"`
	// ChunkSize 每个分片大小（字节）
	ChunkSize int `json:"chunkSize"`
	// TotalChunks 总分片数
	TotalChunks int `json:"totalChunks"`
	// UploadedChunks 断点续传已上传的分片索引
	UploadedChunks []int `json:"uploadedChunks"`
}

// MergeResult 合并上传结果
type MergeResult struct {
	// FileID 文件记录 ID
	FileID string `json:"fileId"`
	// URL 文件访问地址
	URL string `json:"url"`
	// Thumbnail 缩略图地址
	Thumbnail string `json:"thumbnail,omitempty"`
	// Width 图片宽度（仅图片类型）
	Width int `json:"width,omitempty"`
	// Height 图片高度（仅图片类型）
	Height int `json:"height,omitempty"`
}

// InitSession 初始化上传会话
// 1. 验证文件类型和大小
// 2. 秒传检查
// 3. 断点续传恢复
// 4. 创建新会话
func (s *UploadService) InitSession(ctx context.Context, userID uuid.UUID, req InitSessionRequest) (*InitSessionResponse, error) {
	log.Info().Str("service", "UploadService").Str("operation", "InitSession").
		Str("filename", req.FileName).Int64("size", req.FileSize).Msg("开始初始化上传会话")

	// 验证 purpose 白名单
	if req.Purpose != "" && !slices.Contains(allowedPurposes, req.Purpose) {
		log.Warn().Str("purpose", req.Purpose).Msg("不支持的上传用途")
		return nil, ErrInvalidPurpose
	}

	// 验证文件类型
	if err := s.ValidateFileType(req.FileName); err != nil {
		log.Warn().Str("filename", req.FileName).Msg("不支持的文件类型")
		return nil, err
	}

	// 验证文件大小
	if err := s.ValidateFileSize(req.FileSize); err != nil {
		log.Warn().Int64("size", req.FileSize).Int64("max", s.maxFileSize).Msg("文件过大")
		return nil, err
	}

	// 计算分片数量
	chunkSize := req.ChunkSize
	if chunkSize <= 0 {
		chunkSize = 5 * 1024 * 1024 // 默认 5MB
	}
	totalChunks := int((req.FileSize + int64(chunkSize) - 1) / int64(chunkSize))
	if totalChunks == 0 {
		totalChunks = 1
	}

	// 秒传检查：查找 file_hash + status=ready 的记录
	if req.FileHash != "" {
		log.Debug().Str("hash", req.FileHash).Msg("检查秒传")
		existing, err := s.fileSvc.FindByHash(ctx, req.FileHash)
		if err != nil {
			log.Error().Err(err).Msg("秒传检查失败")
			return nil, fmt.Errorf("秒传检查失败: %w", err)
		}
		if existing != nil {
			log.Info().Str("file_id", existing.ID.String()).Msg("秒传命中")
			return &InitSessionResponse{
				Instant: true,
				FileID:  existing.ID.String(),
				URL:     existing.URL,
			}, nil
		}
	}

	// 断点续传恢复：查找 file_hash + user_id + status=active 的会话
	if req.FileHash != "" {
		var session model.UploadSession
		err := s.db.WithContext(ctx).
			Where("file_hash = ? AND user_id = ? AND status = ?", req.FileHash, userID, model.SessionStatusActive).
			First(&session).Error
		if err == nil {
			log.Info().Str("session_id", session.ID.String()).Msg("断点续传恢复")
			return &InitSessionResponse{
				Instant:        false,
				UploadID:       session.ID.String(),
				ChunkSize:      session.ChunkSize,
				TotalChunks:    session.TotalChunks,
				UploadedChunks: []int(session.UploadedChunks),
			}, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			// 数据异常（如旧会话损坏），清理旧会话后继续创建新会话
			log.Warn().Err(err).Msg("旧会话异常，清理后重新创建")
			s.db.WithContext(ctx).
				Where("file_hash = ? AND user_id = ? AND status = ?", req.FileHash, userID, model.SessionStatusActive).
				Delete(&model.UploadSession{})
		}
	}

	// 创建新会话
	sessionID := uuid.New()
	tmpPath := filepath.Join(s.chunkDir, sessionID.String())

	// 创建临时分片目录
	if err := s.storageSvc.EnsureDirectory(tmpPath); err != nil {
		log.Error().Err(err).Str("path", tmpPath).Msg("创建分片目录失败")
		return nil, fmt.Errorf("创建分片目录失败: %w", err)
	}

	// 推断 MIME 类型
	mimeType := req.MimeType
	if mimeType == "" {
		ext := strings.ToLower(filepath.Ext(req.FileName))
		mimeType = detectMimeType(ext)
	}

	// 确定文件用途分类，默认 material（媒体库）
	purpose := req.Purpose
	if purpose == "" {
		purpose = "material"
	}

	session := &model.UploadSession{
		ID:             sessionID,
		UserID:         userID,
		FileName:       req.FileName,
		FileSize:       req.FileSize,
		FileHash:       req.FileHash,
		MimeType:       mimeType,
		Purpose:        purpose,
		ChunkSize:      chunkSize,
		TotalChunks:    totalChunks,
		UploadedChunks: datatypes.NewJSONSlice([]int{}),
		Status:         model.SessionStatusActive,
		TmpPath:        tmpPath,
		ExpiresAt:      time.Now().Add(24 * time.Hour),
	}

	if err := s.db.WithContext(ctx).Create(session).Error; err != nil {
		s.storageSvc.CleanupDirectory(tmpPath)
		log.Error().Err(err).Str("session_id", sessionID.String()).Msg("创建上传会话失败")
		return nil, fmt.Errorf("创建上传会话失败: %w", err)
	}

	log.Info().Str("session_id", sessionID.String()).Int("total_chunks", totalChunks).Msg("上传会话创建成功")
	return &InitSessionResponse{
		Instant:        false,
		UploadID:       sessionID.String(),
		ChunkSize:      chunkSize,
		TotalChunks:    totalChunks,
		UploadedChunks: []int{},
	}, nil
}

// SaveChunk 保存单个分片
func (s *UploadService) SaveChunk(ctx context.Context, uploadID uuid.UUID, index int, reader io.Reader) error {
	log.Info().Str("service", "UploadService").Str("operation", "SaveChunk").
		Str("upload_id", uploadID.String()).Int("index", index).Msg("开始保存分片")

	// 查找会话
	var session model.UploadSession
	err := s.db.WithContext(ctx).
		Where("id = ?", uploadID).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Warn().Str("upload_id", uploadID.String()).Msg("上传会话不存在")
			return ErrUploadNotFound
		}
		log.Error().Err(err).Str("upload_id", uploadID.String()).Msg("查询上传会话失败")
		return fmt.Errorf("查询上传会话失败: %w", err)
	}

	// 验证状态为 active
	if session.Status != model.SessionStatusActive {
		log.Warn().Str("upload_id", uploadID.String()).Str("status", string(session.Status)).Msg("上传会话不在活跃状态")
		return ErrSessionNotActive
	}

	// 验证分片索引范围
	if index < 0 || index >= session.TotalChunks {
		log.Warn().Int("index", index).Int("total", session.TotalChunks).Msg("分片索引超出范围")
		return fmt.Errorf("分片索引 %d 超出范围 [0, %d)", index, session.TotalChunks)
	}

	// 检查分片是否已上传
	if slices.Contains(session.UploadedChunks, index) {
		log.Debug().Int("index", index).Msg("分片已存在")
		return ErrChunkAlreadyExists
	}

	// 保存分片文件
	chunkPath := filepath.Join(session.TmpPath, fmt.Sprintf("chunk_%04d", index))
	dst, err := os.Create(chunkPath)
	if err != nil {
		log.Error().Err(err).Str("path", chunkPath).Msg("创建分片文件失败")
		return fmt.Errorf("创建分片文件失败: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, reader); err != nil {
		log.Error().Err(err).Str("path", chunkPath).Msg("写入分片文件失败")
		return fmt.Errorf("写入分片文件失败: %w", err)
	}

	// 更新 session 的 uploaded_chunks（追加 index）
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 重新读取以获取最新状态（防止并发问题）
		var current model.UploadSession
		if err := tx.Where("id = ? AND status = ?", uploadID, model.SessionStatusActive).First(&current).Error; err != nil {
			return err
		}

		// 追加新分片索引
		chunks := append([]int(current.UploadedChunks), index)
		sort.Ints(chunks)

		return tx.Model(&model.UploadSession{}).
			Where("id = ?", uploadID).
			Update("uploaded_chunks", datatypes.NewJSONSlice(chunks)).Error
	})
	if err != nil {
		log.Error().Err(err).Str("upload_id", uploadID.String()).Msg("更新分片记录失败")
		return fmt.Errorf("更新分片记录失败: %w", err)
	}

	log.Info().Str("upload_id", uploadID.String()).Int("index", index).Msg("分片保存成功")
	return nil
}

// MergeChunks 合并所有分片为完整文件
func (s *UploadService) MergeChunks(ctx context.Context, uploadID uuid.UUID, userID uuid.UUID) (*MergeResult, error) {
	// 查找会话
	var session model.UploadSession
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", uploadID, userID).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUploadNotFound
		}
		return nil, fmt.Errorf("查询上传会话失败: %w", err)
	}

	// 验证所有分片已上传
	if len(session.UploadedChunks) < session.TotalChunks {
		return nil, ErrUploadIncomplete
	}

	// 更新 status=merging（防并发）
	result := s.db.WithContext(ctx).
		Model(&model.UploadSession{}).
		Where("id = ? AND status = ?", uploadID, model.SessionStatusActive).
		Update("status", model.SessionStatusMerging)
	if result.Error != nil {
		return nil, fmt.Errorf("更新会话状态失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, ErrSessionNotActive
	}

	// 合并分片到临时文件
	mergedPath := filepath.Join(session.TmpPath, "merged")
	mergedFile, err := os.Create(mergedPath)
	if err != nil {
		return nil, fmt.Errorf("创建合并文件失败: %w", err)
	}
	defer mergedFile.Close()

	// 直接写入合并文件
	multiWriter := mergedFile

	// 按 chunk_0000, chunk_0001, ... 顺序读取
	for i := 0; i < session.TotalChunks; i++ {
		chunkPath := filepath.Join(session.TmpPath, fmt.Sprintf("chunk_%04d", i))
		chunkFile, err := os.Open(chunkPath)
		if err != nil {
			return nil, fmt.Errorf("打开分片文件 %s 失败: %w", chunkPath, err)
		}
		if _, err := io.Copy(multiWriter, chunkFile); err != nil {
			chunkFile.Close()
			return nil, fmt.Errorf("合并分片失败: %w", err)
		}
		chunkFile.Close()
	}

	// 使用前端提供的哈希（SHA-256 采样哈希），用于秒传匹配
	fileHash := session.FileHash

	// 确定最终文件路径
	ext := strings.ToLower(filepath.Ext(session.FileName))
	fileUUID := uuid.New()
	finalPath, fileURL := s.storageSvc.BuildFilePath(session.Purpose, session.MimeType, fileUUID, ext)

	// 确保目标目录存在
	if err := s.storageSvc.EnsureDirectory(filepath.Dir(finalPath)); err != nil {
		return nil, fmt.Errorf("创建文件目录失败: %w", err)
	}

	// 移动合并后的文件到正式目录
	if err := s.storageSvc.MoveFile(mergedPath, finalPath); err != nil {
		return nil, fmt.Errorf("移动文件失败: %w", err)
	}

	// 获取文件大小
	fileSize, err := s.storageSvc.GetFileSize(finalPath)
	if err != nil {
		log.Warn().Err(err).Str("path", finalPath).Msg("获取文件大小失败")
		fileSize = session.FileSize // 使用会话记录的大小作为后备
	}

	// 生成缩略图
	thumbnail := ""
	var imageWidth, imageHeight int
	storageDir := session.Purpose
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, fileTypeFromMime(session.MimeType))
	}
	if strings.HasPrefix(session.MimeType, "image/") {
		thumbnail = s.storageSvc.GenerateImageThumbnail(finalPath, fileUUID.String(), storageDir)
		// 获取图片尺寸
		imageWidth, imageHeight = s.storageSvc.GetImageDimensions(finalPath)
	} else if strings.HasPrefix(session.MimeType, "video/") {
		thumbnail = s.storageSvc.GenerateVideoThumbnail(finalPath, fileUUID.String(), storageDir)
	}

	// 创建 files 表记录
	fileRecord := &model.File{
		ID:           fileUUID,
		OwnerID:      userID,
		Purpose:      session.Purpose,
		OriginalName: session.FileName,
		Path:         finalPath,
		URL:          fileURL,
		Size:         fileSize,
		MimeType:     session.MimeType,
		FileHash:     fileHash,
		Status:       model.FileStatusReady,
		Thumbnail:    thumbnail,
		RefCount:     0,
	}

	if err := s.fileSvc.Create(ctx, fileRecord); err != nil {
		return nil, fmt.Errorf("创建文件记录失败: %w", err)
	}

	// 清理 tmp 目录
	s.storageSvc.CleanupDirectory(session.TmpPath)

	// 更新 session status=completed
	s.db.WithContext(ctx).
		Model(&model.UploadSession{}).
		Where("id = ?", uploadID).
		Update("status", model.SessionStatusCompleted)

	return &MergeResult{
		FileID:    fileUUID.String(),
		URL:       fileURL,
		Thumbnail: thumbnail,
		Width:     imageWidth,
		Height:    imageHeight,
	}, nil
}

// CancelUpload 取消上传，清理临时分片和会话记录
func (s *UploadService) CancelUpload(ctx context.Context, uploadID uuid.UUID, userID uuid.UUID) error {
	// 查找会话
	var session model.UploadSession
	err := s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", uploadID, userID).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUploadNotFound
		}
		return fmt.Errorf("查询上传会话失败: %w", err)
	}

	// 验证状态为 active
	if session.Status != model.SessionStatusActive {
		return ErrSessionNotActive
	}

	// 删除 tmp 目录
	if session.TmpPath != "" {
		s.storageSvc.CleanupDirectory(session.TmpPath)
	}

	// 删除 session 记录
	if err := s.db.WithContext(ctx).Delete(&session).Error; err != nil {
		return fmt.Errorf("删除上传会话失败: %w", err)
	}

	return nil
}

// GetSession 获取上传会话信息（用于断点续传查询）
func (s *UploadService) GetSession(ctx context.Context, uploadID uuid.UUID) (*model.UploadSession, error) {
	var session model.UploadSession
	err := s.db.WithContext(ctx).
		Where("id = ?", uploadID).
		First(&session).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUploadNotFound
		}
		return nil, fmt.Errorf("查询上传会话失败: %w", err)
	}
	return &session, nil
}
