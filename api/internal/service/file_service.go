package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"

	"blog-api/internal/model"
)

// 文件管理相关错误定义
var (
	// ErrFileNotFound 文件不存在
	ErrFileNotFound = errors.New("文件不存在")
	// ErrFileStillReferenced 文件仍被引用，无法删除
	ErrFileStillReferenced = errors.New("文件仍被引用，无法删除")
)

// FileService 文件管理业务服务
type FileService struct {
	db        *gorm.DB
	uploadDir string
	urlPrefix string
}

// NewFileService 创建文件管理服务实例
func NewFileService(db *gorm.DB, uploadDir, urlPrefix string) *FileService {
	return &FileService{
		db:        db,
		uploadDir: uploadDir,
		urlPrefix: urlPrefix,
	}
}

// FindByHash 秒传查询，查找 status=ready 且 file_hash 匹配的记录
func (s *FileService) FindByHash(ctx context.Context, hash string) (*model.File, error) {
	log.Debug().Str("service", "FileService").Str("operation", "FindByHash").Str("hash", hash).Msg("查询文件哈希")

	var file model.File
	err := s.db.WithContext(ctx).
		Where("file_hash = ? AND status = ?", hash, model.FileStatusReady).
		First(&file).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Debug().Str("hash", hash).Msg("未找到匹配的文件")
			return nil, nil
		}
		log.Error().Err(err).Str("hash", hash).Msg("查询文件哈希失败")
		return nil, fmt.Errorf("查询文件哈希失败: %w", err)
	}
	log.Debug().Str("file_id", file.ID.String()).Str("hash", hash).Msg("找到匹配文件")
	return &file, nil
}

// FindByID 按 ID 查找文件
func (s *FileService) FindByID(ctx context.Context, id uuid.UUID) (*model.File, error) {
	var file model.File
	err := s.db.WithContext(ctx).First(&file, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrFileNotFound
		}
		return nil, fmt.Errorf("查询文件失败: %w", err)
	}
	return &file, nil
}

// Create 创建文件记录
func (s *FileService) Create(ctx context.Context, file *model.File) error {
	log.Info().Str("service", "FileService").Str("operation", "Create").
		Str("file_id", file.ID.String()).Str("filename", file.OriginalName).Msg("创建文件记录")

	if err := s.db.WithContext(ctx).Create(file).Error; err != nil {
		log.Error().Err(err).Str("file_id", file.ID.String()).Msg("创建文件记录失败")
		return fmt.Errorf("创建文件记录失败: %w", err)
	}
	log.Info().Str("file_id", file.ID.String()).Msg("文件记录创建成功")
	return nil
}

// UpdateStatus 更新文件状态
func (s *FileService) UpdateStatus(ctx context.Context, id uuid.UUID, status model.FileStatus) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		Update("status", status)
	if result.Error != nil {
		return fmt.Errorf("更新文件状态失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// UpdateDimensions 更新图片尺寸
func (s *FileService) UpdateDimensions(ctx context.Context, id uuid.UUID, width, height int) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"width":  width,
			"height": height,
		})
	if result.Error != nil {
		return fmt.Errorf("更新文件尺寸失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// IncrementRef 增加引用计数
func (s *FileService) IncrementRef(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		UpdateColumn("ref_count", gorm.Expr("ref_count + 1"))
	if result.Error != nil {
		return fmt.Errorf("增加引用计数失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// DecrementRef 减少引用计数
func (s *FileService) DecrementRef(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ? AND ref_count > 0", id).
		UpdateColumn("ref_count", gorm.Expr("ref_count - 1"))
	if result.Error != nil {
		return fmt.Errorf("减少引用计数失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// SoftDelete 软删除（设 deleted_at = now, status = deleted）
func (s *FileService) SoftDelete(ctx context.Context, id uuid.UUID) error {
	log.Info().Str("service", "FileService").Str("operation", "SoftDelete").
		Str("file_id", id.String()).Msg("开始软删除文件")

	now := time.Now()
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"status":     model.FileStatusDeleted,
		})
	if result.Error != nil {
		log.Error().Err(result.Error).Str("file_id", id.String()).Msg("软删除文件失败")
		return fmt.Errorf("软删除文件失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		log.Warn().Str("file_id", id.String()).Msg("文件不存在")
		return ErrFileNotFound
	}
	log.Info().Str("file_id", id.String()).Msg("文件软删除成功")
	return nil
}

// FindSoftDeleted 查找已软删超过 N 天的文件
func (s *FileService) FindSoftDeleted(ctx context.Context, before time.Time) ([]model.File, error) {
	var files []model.File
	err := s.db.WithContext(ctx).
		Unscoped().
		Where("deleted_at IS NOT NULL AND deleted_at < ?", before).
		Find(&files).Error
	if err != nil {
		return nil, fmt.Errorf("查询已删除文件失败: %w", err)
	}
	return files, nil
}

// HardDelete 物理删除 DB 记录
func (s *FileService) HardDelete(ctx context.Context, id uuid.UUID) error {
	result := s.db.WithContext(ctx).
		Unscoped().
		Where("id = ?", id).
		Delete(&model.File{})
	if result.Error != nil {
		return fmt.Errorf("物理删除文件失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// FileListResult 文件列表查询结果
type FileListResult struct {
	Files []model.File
	Total int64
	Page  int
	Limit int
}

// List 分页查询文件列表，支持按 MIME 类型筛选
func (s *FileService) List(ctx context.Context, page, limit int, mimeType string) (*FileListResult, error) {
	log.Info().Str("service", "FileService").Str("operation", "List").
		Int("page", page).Int("limit", limit).Str("mime_type", mimeType).Msg("查询文件列表")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := s.db.WithContext(ctx).Where("status = ? AND purpose = ?", model.FileStatusReady, "material")
	if mimeType != "" {
		query = query.Where("mime_type LIKE ?", mimeType+"%")
	}

	var total int64
	if err := query.Model(&model.File{}).Count(&total).Error; err != nil {
		log.Error().Err(err).Msg("统计文件数失败")
		return nil, fmt.Errorf("统计文件数失败: %w", err)
	}

	var files []model.File
	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&files).Error; err != nil {
		log.Error().Err(err).Msg("查询文件列表失败")
		return nil, fmt.Errorf("查询文件列表失败: %w", err)
	}

	log.Info().Int64("total", total).Int("count", len(files)).Msg("文件列表查询成功")
	return &FileListResult{
		Files: files,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

// BatchSoftDelete 批量软删除文件
func (s *FileService) BatchSoftDelete(ctx context.Context, ids []uuid.UUID) (int, error) {
	now := time.Now()
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id IN ? AND deleted_at IS NULL", ids).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"status":     model.FileStatusDeleted,
		})
	if result.Error != nil {
		return 0, fmt.Errorf("批量软删除文件失败: %w", result.Error)
	}
	return int(result.RowsAffected), nil
}

// UpdateThumbnail 更新文件缩略图
func (s *FileService) UpdateThumbnail(ctx context.Context, id uuid.UUID, thumbnail string) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		Update("thumbnail", thumbnail)
	if result.Error != nil {
		return fmt.Errorf("更新缩略图失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// Update 更新文件记录（通用）
func (s *FileService) Update(ctx context.Context, id uuid.UUID, updates map[string]interface{}) error {
	result := s.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		Updates(updates)
	if result.Error != nil {
		return fmt.Errorf("更新文件失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrFileNotFound
	}
	return nil
}

// ListByOwner 分页查询用户文件列表
func (s *FileService) ListByOwner(ctx context.Context, ownerID uuid.UUID, page, limit int) ([]model.File, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var files []model.File
	var total int64

	query := s.db.WithContext(ctx).Where("owner_id = ?", ownerID)

	if err := query.Model(&model.File{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计文件数失败: %w", err)
	}

	if err := query.Order("created_at DESC").Offset(offset).Limit(limit).Find(&files).Error; err != nil {
		return nil, 0, fmt.Errorf("查询文件列表失败: %w", err)
	}

	return files, total, nil
}
