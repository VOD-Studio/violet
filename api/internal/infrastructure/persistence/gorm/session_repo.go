package gorm

import (
	"context"
	"errors"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
	"blog-api/internal/model"
)

// UploadSessionRepository 上传会话仓储（复用旧 model.UploadSession）
type UploadSessionRepository struct{ db *gorm.DB }

func NewUploadSessionRepository(db *gorm.DB) *UploadSessionRepository {
	return &UploadSessionRepository{db: db}
}

func sessionToPO(s *upload.UploadSession) (model.UploadSession, error) {
	chunks := datatypes.NewJSONSlice(s.UploadedChunks())
	return model.UploadSession{
		ID: s.ID().UUID(), UserID: s.UserID().UUID(),
		FileName: s.FileName(), FileSize: s.FileSize(),
		MimeType: s.MimeType(), FileHash: s.FileHash(),
		Purpose: s.Purpose(), ChunkSize: s.ChunkSize(),
		TotalChunks: s.TotalChunks(), UploadedChunks: chunks,
		Status: model.SessionStatus(s.Status()), TmpPath: s.TmpPath(),
		ExpiresAt: s.ExpiresAt(),
	}, nil
}

func sessionToDomain(po model.UploadSession) (*upload.UploadSession, error) {
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
	var po model.UploadSession
	if err := r.db.WithContext(ctx).First(&po, "id = ?", id.UUID()).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, upload.ErrSessionNotFound
		}
		return nil, domainshared.Internal("查询上传会话失败", err)
	}
	return sessionToDomain(po)
}

func (r *UploadSessionRepository) FindByHash(ctx context.Context, hash string, userID domainshared.ID) (*upload.UploadSession, error) {
	var po model.UploadSession
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

func (r *UploadSessionRepository) Delete(ctx context.Context, id domainshared.ID) error {
	result := r.db.WithContext(ctx).Where("id = ?", id.UUID()).Delete(&model.UploadSession{})
	if result.Error != nil {
		return domainshared.Internal("删除上传会话失败", result.Error)
	}
	return nil
}

func (r *UploadSessionRepository) DeleteExpired(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ? AND status != ?", time.Now(), upload.SessionCompleted).
		Delete(&model.UploadSession{}).Error
}

var _ upload.UploadSessionRepository = (*UploadSessionRepository)(nil)
