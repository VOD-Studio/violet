package gorm

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	appmedia "blog-api/internal/application/media"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/storage"
)

func TestUploadSessionIntegrationCancelAndCompleteHaveOneWinner(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	files := NewFileRepository(db)
	ctx := context.Background()
	owner := preseedAuthor(t, db)

	for range 12 {
		id, fileID := shared.NewID(), shared.NewID()
		now := time.Now()
		session := upload.ReconstructUploadSession(id, owner, "image.png", 10, "image/png",
			"source-hash", upload.PurposeMaterial, 10, 1, []int{0}, upload.SessionMerging,
			"uploads/tmp/"+id.String(), now.Add(time.Hour), now, now, nil)
		require.NoError(t, repository.Save(ctx, session))
		file, err := upload.NewFile(fileID, owner, upload.PurposeMaterial, "image.png",
			"uploads/"+fileID.String()+".png", "/uploads/"+fileID.String()+".png", 10, "image/png", "source-hash")
		require.NoError(t, err)

		start := make(chan struct{})
		var completeErr, cancelErr error
		var cancelled *upload.UploadSession
		var workers sync.WaitGroup
		workers.Add(2)
		go func() {
			defer workers.Done()
			<-start
			completeErr = repository.Complete(ctx, id, file)
		}()
		go func() {
			defer workers.Done()
			<-start
			cancelled, cancelErr = NewUploadSessionRepository(db.Session(&gorm.Session{})).Cancel(ctx, id, owner)
		}()
		close(start)
		workers.Wait()
		require.NoError(t, cancelErr)

		stored, err := repository.FindByID(ctx, id)
		require.NoError(t, err)
		persistedFile, fileErr := files.FindByID(ctx, fileID)
		if completeErr == nil {
			require.Equal(t, upload.SessionCompleted, stored.Status())
			require.Equal(t, upload.SessionCompleted, cancelled.Status())
			require.NotNil(t, stored.ResultFileID())
			require.True(t, stored.ResultFileID().Equal(fileID))
			require.NoError(t, fileErr)
			require.Equal(t, file.URL(), persistedFile.URL())
		} else {
			require.ErrorIs(t, completeErr, upload.ErrSessionCancelled)
			require.Equal(t, upload.SessionCancelled, stored.Status())
			require.Nil(t, stored.ResultFileID())
			require.ErrorIs(t, fileErr, upload.ErrFileNotFound)
		}
	}
}

func TestUploadSessionIntegrationCancelledIDCannotBeInitializedLater(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	ctx := context.Background()
	owner := preseedAuthor(t, db)
	id := shared.NewID()
	_, err := repository.Cancel(ctx, id, owner)
	require.NoError(t, err)
	for range 2 {
		session, err := upload.NewUploadSession(id, owner, "image.png", 10, "image/png", "hash", upload.PurposeMaterial, 10, 1)
		require.NoError(t, err)
		require.NoError(t, NewUploadSessionRepository(db.Session(&gorm.Session{})).Save(ctx, session))
	}
	stored, err := repository.FindByID(ctx, id)
	require.NoError(t, err)
	require.Equal(t, upload.SessionCancelled, stored.Status())
	require.Equal(t, []int{}, stored.UploadedChunks())
	require.ErrorIs(t, repository.AppendChunk(ctx, id, 0), upload.ErrSessionNotFound)
}

func TestUploadSessionIntegrationCompletionFailureDoesNotPublishFile(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	ctx := context.Background()
	owner := preseedAuthor(t, db)
	id := shared.NewID()
	now := time.Now()
	session := upload.ReconstructUploadSession(id, owner, "image.png", 10, "image/png", "hash",
		upload.PurposeMaterial, 10, 1, []int{0}, upload.SessionMerging, "", now.Add(time.Hour), now, now, nil)
	require.NoError(t, repository.Save(ctx, session))
	file, err := upload.NewFile(shared.NewID(), owner, upload.PurposeMaterial, "image.png", "uploads/image.png", "/uploads/image.png", 10, "image/png", "hash")
	require.NoError(t, err)
	// 文件外键合法，但超长 MIME 会让真实数据库拒绝插入，整个完成事务必须回滚。
	file.ReplaceStoredFile(file.Path(), file.URL(), 10, strings.Repeat("x", 200), "hash", nil, nil, "")
	require.Error(t, repository.Complete(ctx, id, file))
	stored, err := repository.FindByID(ctx, id)
	require.NoError(t, err)
	require.Equal(t, upload.SessionMerging, stored.Status())
	require.Nil(t, stored.ResultFileID())
	_, err = NewFileRepository(db).FindByID(ctx, file.ID())
	require.ErrorIs(t, err, upload.ErrFileNotFound)
}

func TestUploadSessionIntegrationServiceCancellationDuringMerge(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	files := NewFileRepository(db)
	owner := preseedAuthor(t, db)
	root := t.TempDir()
	service := appmedia.NewUploadService(files, repository, storage.NewLocalStorage(root, "/uploads/"), nil, filepath.Join(root, "chunks"), root, "/uploads/")
	ctx := context.Background()
	content := []byte("%PDF-1.7\ncancel during merge")
	session, err := service.InitSession(ctx, appmedia.InitSessionInput{
		UserID: owner.String(), FileName: "cancel.pdf", FileSize: int64(len(content)),
		MimeType: "application/pdf", ChunkSize: len(content), Purpose: upload.PurposeMaterial,
	})
	require.NoError(t, err)
	require.NoError(t, service.SaveChunk(ctx, session.UploadID, 0, content, owner.String()))
	chunkPath := filepath.Join(root, "chunks", session.UploadID, "chunk_0000")
	require.NoError(t, os.Remove(chunkPath))
	require.NoError(t, syscall.Mkfifo(chunkPath, 0o600))
	completed := make(chan error, 1)
	go func() {
		_, err := service.CompleteUpload(ctx, session.UploadID, owner.String())
		completed <- err
	}()
	// FIFO 只阻塞真实分片读取，取消仍走真实仓储和目录清理。
	var writer *os.File
	require.Eventually(t, func() bool {
		fd, err := syscall.Open(chunkPath, syscall.O_WRONLY|syscall.O_NONBLOCK, 0)
		if err != nil {
			return false
		}
		writer = os.NewFile(uintptr(fd), chunkPath)
		return true
	}, 5*time.Second, time.Millisecond)
	defer writer.Close()
	cancelled, err := service.CancelUpload(ctx, session.UploadID, owner.String())
	require.NoError(t, err)
	require.False(t, cancelled.Completed)
	_, err = writer.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	select {
	case err := <-completed:
		require.ErrorIs(t, err, upload.ErrSessionCancelled)
	case <-time.After(5 * time.Second):
		t.Fatal("取消后合并未结束")
	}
	stored, err := repository.FindByID(ctx, shared.MustParseID(session.UploadID))
	require.NoError(t, err)
	require.Equal(t, upload.SessionCancelled, stored.Status())
	require.Nil(t, stored.ResultFileID())
	_, err = os.Stat(filepath.Join(root, "chunks", session.UploadID))
	require.True(t, os.IsNotExist(err))
	_, err = files.FindByHash(ctx, "", owner)
	require.ErrorIs(t, err, upload.ErrFileNotFound)
}

func TestUploadSessionIntegrationServiceCancellationBeforeMergeCAS(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	owner := preseedAuthor(t, db)
	root := t.TempDir()
	service := appmedia.NewUploadService(NewFileRepository(db), repository, storage.NewLocalStorage(root, "/uploads/"), nil, filepath.Join(root, "chunks"), root, "/uploads/")
	ctx := context.Background()
	content := []byte("%PDF-1.7\ncancel before merge")
	session, err := service.InitSession(ctx, appmedia.InitSessionInput{
		UserID: owner.String(), FileName: "cancel.pdf", FileSize: int64(len(content)),
		MimeType: "application/pdf", ChunkSize: len(content), Purpose: upload.PurposeMaterial,
	})
	require.NoError(t, err)
	require.NoError(t, service.SaveChunk(ctx, session.UploadID, 0, content, owner.String()))
	var cancelled atomic.Bool
	const callback = "test:cancel_upload_before_merge"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Table == "upload_sessions" && cancelled.CompareAndSwap(false, true) {
			_, cancelErr := service.CancelUpload(ctx, session.UploadID, owner.String())
			require.NoError(t, cancelErr)
		}
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Query().Remove(callback)) })
	_, err = service.CompleteUpload(ctx, session.UploadID, owner.String())
	require.ErrorIs(t, err, upload.ErrSessionCancelled)
	stored, err := repository.FindByID(ctx, shared.MustParseID(session.UploadID))
	require.NoError(t, err)
	require.Equal(t, upload.SessionCancelled, stored.Status())
}

func TestUploadSessionIntegrationServiceMissingChunkRemainsStorageFailure(t *testing.T) {
	db := setupIntegrationDB(t)
	repository := NewUploadSessionRepository(db)
	owner := preseedAuthor(t, db)
	root := t.TempDir()
	service := appmedia.NewUploadService(NewFileRepository(db), repository, storage.NewLocalStorage(root, "/uploads/"), nil, filepath.Join(root, "chunks"), root, "/uploads/")
	ctx := context.Background()
	content := []byte("%PDF-1.7\nmissing chunk")
	session, err := service.InitSession(ctx, appmedia.InitSessionInput{
		UserID: owner.String(), FileName: "missing.pdf", FileSize: int64(len(content)),
		MimeType: "application/pdf", ChunkSize: len(content), Purpose: upload.PurposeMaterial,
	})
	require.NoError(t, err)
	require.NoError(t, service.SaveChunk(ctx, session.UploadID, 0, content, owner.String()))
	require.NoError(t, os.Remove(filepath.Join(root, "chunks", session.UploadID, "chunk_0000")))
	_, err = service.CompleteUpload(ctx, session.UploadID, owner.String())
	require.True(t, shared.IsDomainError(err, shared.CodeInternal), "未取消时必须保留真实存储错误: %v", err)
	stored, err := repository.FindByID(ctx, shared.MustParseID(session.UploadID))
	require.NoError(t, err)
	require.Equal(t, upload.SessionActive, stored.Status())
}
