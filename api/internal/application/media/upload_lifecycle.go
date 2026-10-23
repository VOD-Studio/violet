package media

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// InitSession 复用稳定上传标识；取消墓碑不能被迟到的初始化覆盖。
func (s *UploadService) InitSession(ctx context.Context, in InitSessionInput) (*InitSessionResult, error) {
	uid, err := shared.ParseID(in.UserID)
	if err != nil {
		return nil, err
	}
	ext := strings.ToLower(filepath.Ext(in.FileName))
	if _, ok := allowedUploadTypes[ext]; !ok {
		return nil, shared.BadRequest("不支持的文件类型")
	}
	if in.FileSize <= 0 || in.FileSize > maxFileSize {
		return nil, shared.BadRequest("文件大小须大于 0 且不超过 1GB")
	}
	if in.Purpose == "" {
		in.Purpose = domainupload.PurposeMaterial
	}
	if !domainupload.IsValidPurpose(in.Purpose) {
		return nil, shared.BadRequest("无效的文件用途")
	}
	if in.ChunkSize <= 0 {
		in.ChunkSize = 5 << 20
	}
	if in.ChunkSize > 32<<20 {
		return nil, shared.BadRequest("分片大小不能超过 32MB")
	}
	if in.MimeType == "" {
		in.MimeType = allowedUploadTypes[ext]
	}
	sid := shared.NewID()
	if in.ClientUploadID != "" {
		sid, err = shared.ParseID(in.ClientUploadID)
		if err != nil {
			return nil, shared.BadRequest("无效的客户端上传标识")
		}
		existing, err := s.sessionRepo.FindByID(ctx, sid)
		if err == nil {
			return s.resumeUpload(ctx, existing, uid, in)
		}
		if !errors.Is(err, domainupload.ErrSessionNotFound) {
			return nil, err
		}
	}

	if in.FileHash != "" {
		file, err := s.fileRepo.FindByHash(ctx, in.FileHash, uid)
		if err != nil && !errors.Is(err, domainupload.ErrFileNotFound) {
			return nil, err
		}
		if file != nil {
			available, err := s.isStoredFileAvailable(ctx, file)
			if err != nil {
				return nil, err
			}
			if available {
				if in.ClientUploadID == "" {
					return &InitSessionResult{Instant: true, FileID: file.ID().String(), URL: file.URL(), UploadedChunks: []int{}}, nil
				}
				fileID := file.ID()
				session := domainupload.ReconstructUploadSession(
					sid, uid, in.FileName, in.FileSize, in.MimeType, in.FileHash, in.Purpose,
					in.ChunkSize, 0, []int{}, domainupload.SessionCompleted, "",
					time.Now().Add(24*time.Hour), time.Time{}, time.Time{}, &fileID,
				)
				if err := s.sessionRepo.Save(ctx, session); err != nil {
					return nil, err
				}
				stored, err := s.sessionRepo.FindByID(ctx, sid)
				if err != nil {
					return nil, err
				}
				return s.resumeUpload(ctx, stored, uid, in)
			}
		}
		if in.ClientUploadID == "" {
			existing, err := s.sessionRepo.FindByHash(ctx, in.FileHash, uid)
			if err != nil && !errors.Is(err, domainupload.ErrSessionNotFound) {
				return nil, err
			}
			if existing != nil {
				return s.uploadSessionResult(ctx, existing, uid)
			}
		}
	}

	totalChunks := int((in.FileSize + int64(in.ChunkSize) - 1) / int64(in.ChunkSize))
	tmpPath := filepath.Join(s.chunkDir, sid.String())
	session := domainupload.ReconstructUploadSession(
		sid, uid, in.FileName, in.FileSize, in.MimeType, in.FileHash, in.Purpose,
		in.ChunkSize, totalChunks, []int{}, domainupload.SessionActive, tmpPath,
		time.Now().Add(24*time.Hour), time.Time{}, time.Time{}, nil,
	)
	if err := s.sessionRepo.Save(ctx, session); err != nil {
		return nil, err
	}
	stored, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
	}
	result, err := s.resumeUpload(ctx, stored, uid, in)
	if err != nil || result.Instant {
		return result, err
	}
	if err := s.storage.EnsureDir(stored.TmpPath()); err != nil {
		return nil, shared.Internal("创建分片目录失败", err)
	}
	// 取消可能先清掉目录；迟到的初始化必须再次检查，不能留下重新创建的目录。
	latest, err := s.sessionRepo.FindByID(ctx, sid)
	if err != nil {
		return nil, err
	}
	result, err = s.resumeUpload(ctx, latest, uid, in)
	if errors.Is(err, domainupload.ErrSessionCancelled) {
		_ = s.storage.CleanupDir(stored.TmpPath())
	}
	return result, err
}

func (s *UploadService) resumeUpload(ctx context.Context, session *domainupload.UploadSession, uid shared.ID, in InitSessionInput) (*InitSessionResult, error) {
	if !session.UserID().Equal(uid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() != domainupload.SessionCancelled &&
		(session.FileHash() != in.FileHash || session.FileSize() != in.FileSize || session.Purpose() != in.Purpose) {
		return nil, shared.Conflict("上传标识已用于其他文件")
	}
	return s.uploadSessionResult(ctx, session, uid)
}

func (s *UploadService) uploadSessionResult(ctx context.Context, session *domainupload.UploadSession, uid shared.ID) (*InitSessionResult, error) {
	if !session.UserID().Equal(uid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	switch session.Status() {
	case domainupload.SessionCancelled:
		return nil, domainupload.ErrSessionCancelled
	case domainupload.SessionCompleted:
		result, err := s.completedUploadResult(ctx, session)
		if err != nil {
			return nil, err
		}
		return &InitSessionResult{Instant: true, FileID: result.FileID, URL: result.URL, UploadedChunks: []int{}}, nil
	case domainupload.SessionMerging:
		return nil, shared.Conflict("文件正在合并，请稍后重试")
	case domainupload.SessionActive:
		if session.IsExpired() {
			return nil, domainupload.ErrSessionExpired
		}
		return &InitSessionResult{
			UploadID: session.ID().String(), ChunkSize: session.ChunkSize(),
			TotalChunks: session.TotalChunks(), UploadedChunks: session.UploadedChunks(),
		}, nil
	default:
		return nil, domainupload.ErrSessionExpired
	}
}

func (s *UploadService) completedUploadResult(ctx context.Context, session *domainupload.UploadSession) (*MergeResult, error) {
	if session.ResultFileID() == nil {
		return nil, shared.Conflict("上传已完成，请在素材列表查看结果")
	}
	file, err := s.fileRepo.FindByID(ctx, *session.ResultFileID())
	if err != nil {
		return nil, err
	}
	if !file.OwnerID().Equal(session.UserID()) {
		return nil, shared.Forbidden("无权访问上传结果")
	}
	result := &MergeResult{FileID: file.ID().String(), URL: file.URL(), Thumbnail: file.Thumbnail()}
	if file.Width() != nil {
		result.Width = *file.Width()
	}
	if file.Height() != nil {
		result.Height = *file.Height()
	}
	return result, nil
}

type CancelUploadResult struct {
	// Completed 为 true 表示正式文件已经先于取消原子提交，不能显示为已取消。
	Completed bool         `json:"completed"`
	File      *MergeResult `json:"file,omitempty"`
}

// CancelUpload 对尚未返回初始化响应的稳定 ID 同样记录取消。
func (s *UploadService) CancelUpload(ctx context.Context, uploadID, callerID string) (*CancelUploadResult, error) {
	sid, err := shared.ParseID(uploadID)
	if err != nil {
		return nil, err
	}
	uid, err := shared.ParseID(callerID)
	if err != nil {
		return nil, shared.BadRequest("无效的调用者 ID")
	}
	session, err := s.sessionRepo.Cancel(ctx, sid, uid)
	if err != nil {
		return nil, err
	}
	if !session.UserID().Equal(uid) {
		return nil, shared.Forbidden("无权操作他人上传会话")
	}
	if session.Status() == domainupload.SessionCompleted {
		result, err := s.completedUploadResult(ctx, session)
		if err != nil {
			return nil, err
		}
		return &CancelUploadResult{Completed: true, File: result}, nil
	}
	if session.TmpPath() != "" {
		if err := s.storage.CleanupDir(session.TmpPath()); err != nil {
			return nil, shared.Internal("上传已取消，但临时文件清理失败", err)
		}
	}
	return &CancelUploadResult{}, nil
}

func (s *UploadService) cleanupUncommittedUpload(path, thumbnail string) {
	_ = s.storage.CleanupDir(path)
	if !strings.HasPrefix(thumbnail, s.urlPrefix) {
		return
	}
	rel := strings.TrimPrefix(thumbnail, s.urlPrefix)
	if rel == "" || filepath.IsAbs(rel) || strings.HasPrefix(filepath.Clean(rel), "..") {
		return
	}
	_ = s.storage.CleanupDir(filepath.Join(s.uploadDir, filepath.FromSlash(rel)))
}
