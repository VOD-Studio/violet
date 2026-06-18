package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
	newmodel "blog-api/internal/infrastructure/persistence/gorm/model"
)

// UploadSessionRepository 上传会话仓储（复用旧 newmodel.UploadSession）
type UploadSessionRepository struct{ db *gorm.DB }

func NewUploadSessionRepository(db *gorm.DB) *UploadSessionRepository {
	return &UploadSessionRepository{db: db}
}

func sessionToPO(s *upload.UploadSession) (newmodel.UploadSession, error) {
	chunks := datatypes.NewJSONSlice(s.UploadedChunks())
	return newmodel.UploadSession{
		ID: s.ID().UUID(), UserID: s.UserID().UUID(),
		FileName: s.FileName(), FileSize: s.FileSize(),
		MimeType: s.MimeType(), FileHash: s.FileHash(),
		Purpose: s.Purpose(), ChunkSize: s.ChunkSize(),
		TotalChunks: s.TotalChunks(), UploadedChunks: chunks,
		Status: newmodel.SessionStatus(s.Status()), TmpPath: s.TmpPath(),
		ExpiresAt: s.ExpiresAt(),
	}, nil
}

func sessionToDomain(po newmodel.UploadSession) (*upload.UploadSession, error) {
	chunks := make([]int, 0, len(po.UploadedChunks))
	for _, v := range po.UploadedChunks {
		chunks = append(chunks, int(v))
	}
	return upload.ReconstructUploadSession(
		domainshared.MustParseID(po.ID.String()),
		domainshared.MustParseID(po.UserID.String()),
		po.FileName, po.FileSize, po.MimeType, po.FileHash, po.Purpose,
		po.ChunkSize, po.TotalChunks, chunks, string(po.Status), po.TmpPath,
		po.ExpiresAt, po.CreatedAt, po.UpdatedAt,
	), nil
}

func (r *UploadSessionRepository) FindByID(ctx context.Context, id domainshared.ID) (*upload.UploadSession, error) {
	var po newmodel.UploadSession
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrSessionNotFound
		}
		return nil, domainshared.Internal("查询上传会话失败", err)
	}
	return sessionToDomain(po)
}

func (r *UploadSessionRepository) FindByHash(ctx context.Context, hash string, userID domainshared.ID) (*upload.UploadSession, error) {
	var po newmodel.UploadSession
	if err := r.db.WithContext(ctx).
		Where("file_hash = ? AND user_id = ? AND status = ?", hash, userID.UUID(), upload.SessionActive).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrSessionNotFound
		}
		return nil, domainshared.Internal("查询上传会话失败", err)
	}
	return sessionToDomain(po)
}

func (r *UploadSessionRepository) Save(ctx context.Context, s *upload.UploadSession) error {
	po, err := sessionToPO(s)
	if err != nil {
		return err
	}
	if err := r.db.WithContext(ctx).Save(&po).Error; err != nil {
		return domainshared.Internal("保存上传会话失败", err)
	}
	return nil
}

// UpdateStatus CAS 更新会话状态，仅当 oldStatus 匹配时更新为 newStatus
func (r *UploadSessionRepository) UpdateStatus(ctx context.Context, id domainshared.ID, oldStatus, newStatus string) (bool, error) {
	result := r.db.WithContext(ctx).
		Model(&newmodel.UploadSession{}).
		Where("id = ? AND status = ?", id.UUID(), newmodel.SessionStatus(oldStatus)).
		Update("status", newmodel.SessionStatus(newStatus))
	if result.Error != nil {
		return false, domainshared.Internal("更新会话状态失败", result.Error)
	}
	return result.RowsAffected > 0, nil
}

// AppendChunk 追加已上传分片索引（事务内重读 + 排序写入，防并发）
func (r *UploadSessionRepository) AppendChunk(ctx context.Context, id domainshared.ID, index int) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var po newmodel.UploadSession
		if err := tx.Where("id = ? AND status = ?", id.UUID(), upload.SessionActive).First(&po).Error; err != nil {
			return err
		}
		// 检查是否已存在（幂等）
		for _, v := range po.UploadedChunks {
			if int(v) == index {
				return nil
			}
		}
		chunks := append([]int{}, po.UploadedChunks...)
		chunks = append(chunks, index)
		// 排序
		for i := 1; i < len(chunks); i++ {
			for j := i; j > 0 && chunks[j] < chunks[j-1]; j++ {
				chunks[j], chunks[j-1] = chunks[j-1], chunks[j]
			}
		}
		return tx.Model(&newmodel.UploadSession{}).
			Where("id = ?", id.UUID()).
			Update("uploaded_chunks", datatypes.NewJSONSlice(chunks)).Error
	})
}

func (r *UploadSessionRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&newmodel.UploadSession{})
	if result.Error != nil {
		return domainshared.Internal("删除上传会话失败", result.Error)
	}
	return nil
}

func (r *UploadSessionRepository) DeleteExpired(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ? AND status != ?", time.Now(), upload.SessionCompleted).
		Delete(&newmodel.UploadSession{}).Error
}

var _ upload.UploadSessionRepository = (*UploadSessionRepository)(nil)
