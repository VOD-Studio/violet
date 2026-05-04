package service

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/disintegration/imaging"
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
)

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

// detectMimeType 根据文件扩展名推断 MIME 类型
func detectMimeType(ext string) string {
	if mt, ok := allowedUploadTypes[strings.ToLower(ext)]; ok {
		return mt
	}
	return "application/octet-stream"
}

// fileTypeFromMime 根据 MIME 类型推断文件分类目录名
func fileTypeFromMime(mimeType string) string {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case strings.HasPrefix(mimeType, "video/"):
		return "video"
	case strings.HasPrefix(mimeType, "audio/"):
		return "audio"
	default:
		return "file"
	}
}

// UploadService 分片上传业务服务
type UploadService struct {
	db          *gorm.DB   // GORM 数据库实例
	fileSvc     *FileService // 文件管理服务
	chunkDir    string     // 临时分片目录，如 "uploads/tmp"
	uploadDir   string     // 最终文件目录，如 "uploads"
	urlPrefix   string     // URL 前缀，如 "/uploads/"
	maxFileSize int64      // 最大文件大小（字节）
}

// NewUploadService 创建分片上传服务实例
func NewUploadService(db *gorm.DB, fileSvc *FileService, chunkDir, uploadDir, urlPrefix string, maxFileSize int64) *UploadService {
	return &UploadService{
		db:          db,
		fileSvc:     fileSvc,
		chunkDir:    chunkDir,
		uploadDir:   uploadDir,
		urlPrefix:   urlPrefix,
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
}

// InitSession 初始化上传会话
// 1. 验证文件类型和大小
// 2. 秒传检查
// 3. 断点续传恢复
// 4. 创建新会话
func (s *UploadService) InitSession(ctx context.Context, userID uuid.UUID, req InitSessionRequest) (*InitSessionResponse, error) {
	log.Info().Str("service", "UploadService").Str("operation", "InitSession").
		Str("filename", req.FileName).Int64("size", req.FileSize).Msg("开始初始化上传会话")

	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(req.FileName))
	if _, ok := allowedUploadTypes[ext]; !ok {
		log.Warn().Str("ext", ext).Msg("不支持的文件类型")
		return nil, ErrInvalidImageType
	}

	// 验证文件大小
	if req.FileSize > s.maxFileSize {
		log.Warn().Int64("size", req.FileSize).Int64("max", s.maxFileSize).Msg("文件过大")
		return nil, ErrImageTooLarge
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
	if err := os.MkdirAll(tmpPath, 0755); err != nil {
		log.Error().Err(err).Str("path", tmpPath).Msg("创建分片目录失败")
		return nil, fmt.Errorf("创建分片目录失败: %w", err)
	}

	// 推断 MIME 类型
	mimeType := req.MimeType
	if mimeType == "" {
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
		Purpose:       purpose,
		ChunkSize:      chunkSize,
		TotalChunks:    totalChunks,
		UploadedChunks: datatypes.NewJSONSlice([]int{}),
		Status:         model.SessionStatusActive,
		TmpPath:        tmpPath,
		ExpiresAt:      time.Now().Add(24 * time.Hour),
	}

	if err := s.db.WithContext(ctx).Create(session).Error; err != nil {
		os.RemoveAll(tmpPath)
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
	storageDir := session.Purpose
	// material 按 MIME 类型分子目录：material/image, material/video, material/audio, material/file
	if storageDir == "material" {
		storageDir = filepath.Join(storageDir, fileTypeFromMime(session.MimeType))
	}
	fileUUID := uuid.New()
	finalName := fileUUID.String() + ext
	finalDir := filepath.Join(s.uploadDir, storageDir)

	// 确保目标目录存在
	if err := os.MkdirAll(finalDir, 0755); err != nil {
		return nil, fmt.Errorf("创建文件目录失败: %w", err)
	}

	finalPath := filepath.Join(finalDir, finalName)

	// 移动合并后的文件到正式目录
	if err := os.Rename(mergedPath, finalPath); err != nil {
		return nil, fmt.Errorf("移动文件失败: %w", err)
	}

	// 构建文件 URL
	fileURL := s.urlPrefix + storageDir + "/" + finalName

	// 获取文件大小
	fileInfo, _ := os.Stat(finalPath)
	var fileSize int64
	if fileInfo != nil {
		fileSize = fileInfo.Size()
	}

	// 生成缩略图
	thumbnail := ""
	if strings.HasPrefix(session.MimeType, "image/") {
		thumbnail = s.generateImageThumbnail(finalPath, fileUUID.String(), storageDir)
	} else if strings.HasPrefix(session.MimeType, "video/") {
		thumbnail = s.generateVideoThumbnail(finalPath, fileUUID.String(), storageDir)
	}

	// 创建 files 表记录
	fileRecord := &model.File{
		ID:           fileUUID,
		OwnerID:      userID,
		Purpose:     session.Purpose,
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
	os.RemoveAll(session.TmpPath)

	// 更新 session status=completed
	s.db.WithContext(ctx).
		Model(&model.UploadSession{}).
		Where("id = ?", uploadID).
		Update("status", model.SessionStatusCompleted)

	return &MergeResult{
		FileID:    fileUUID.String(),
		URL:       fileURL,
		Thumbnail: thumbnail,
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
		os.RemoveAll(session.TmpPath)
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

// ComputeMD5 计算文件的 MD5 哈希值
func ComputeMD5(reader io.Reader) (string, error) {
	h := md5.New()
	if _, err := io.Copy(h, reader); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// generateImageThumbnail 生成图片缩略图
// 最大宽度 300px，保持原始比例，保存为 JPEG 格式
// 返回缩略图的 URL
func (s *UploadService) generateImageThumbnail(filePath, fileUUID, fileType string) string {
	img, err := imaging.Open(filePath)
	if err != nil {
		return ""
	}

	// 缩略图尺寸：最大宽 300px，保持比例
	thumb := imaging.Resize(img, 300, 0, imaging.Lanczos)

	// 缩略图文件名
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, fileType)
	thumbPath := filepath.Join(thumbDir, thumbName)

	// 保存为 JPEG，质量 80%
	if err := imaging.Save(thumb, thumbPath, imaging.JPEGQuality(80)); err != nil {
		return ""
	}

	return s.urlPrefix + fileType + "/" + thumbName
}

// generateVideoThumbnail 使用 ffmpeg 提取视频第 1 秒帧作为缩略图
// 最大宽度 300px，保存为 JPEG 格式
// 返回缩略图的 URL
func (s *UploadService) generateVideoThumbnail(filePath, fileUUID, fileType string) string {
	// 检查 ffmpeg 是否可用
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return ""
	}

	// 缩略图文件名
	thumbName := fileUUID + "_thumb.jpg"
	thumbDir := filepath.Join(s.uploadDir, fileType)
	thumbPath := filepath.Join(thumbDir, thumbName)

	// 确保目录存在
	os.MkdirAll(thumbDir, 0755)

	// 使用 ffmpeg 提取第 1 秒的帧
	cmd := exec.Command("ffmpeg",
		"-i", filePath,
		"-ss", "1",
		"-vframes", "1",
		"-vf", "scale=300:-1",
		"-f", "image2",
		thumbPath,
		"-y",
	)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return ""
	}

	// 检查缩略图是否生成成功
	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		return ""
	}

	return s.urlPrefix + fileType + "/" + thumbName
}
