package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/upload"
)

// uploadSessionMigrate 是 model.UploadSession 的测试迁移镜像。
//
// model.UploadSession.id 带 default:gen_random_uuid()（PostgreSQL 函数），
// SQLite AutoMigrate 会生成该函数调用导致 "near (: syntax error"，无法建表。
// 此镜像去掉该 PG 专属 default，其余列定义与 model.UploadSession 逐列一致，
// 供 setupSessionTestDB 建表；repo 仍以 model.UploadSession 读写同一张表。
type uploadSessionMigrate struct {
	ID             uuid.UUID                `gorm:"type:uuid;primaryKey" json:"uploadId"`
	UserID         uuid.UUID                `gorm:"type:uuid;not null;index" json:"userId"`
	FileName       string                   `gorm:"size:255;not null" json:"fileName"`
	FileSize       int64                    `gorm:"not null" json:"fileSize"`
	FileHash       string                   `gorm:"size:64;not null;index" json:"fileHash"`
	MimeType       string                   `gorm:"size:100;not null" json:"mimeType"`
	Purpose        string                   `gorm:"column:purpose;size:20;not null;default:material" json:"purpose"`
	ChunkSize      int                      `gorm:"not null;default:5242880" json:"chunkSize"`
	TotalChunks    int                      `gorm:"not null" json:"totalChunks"`
	UploadedChunks datatypes.JSONSlice[int] `gorm:"type:jsonb;not null" json:"uploadedChunks"`
	Status         string                   `gorm:"size:20;not null;default:active;index" json:"status"`
	TmpPath        string                   `gorm:"size:500;not null" json:"-"`
	ExpiresAt      time.Time                `gorm:"not null;index" json:"expiresAt"`
	CreatedAt      time.Time                `json:"createdAt"`
	UpdatedAt      time.Time                `json:"updatedAt"`
}

func (uploadSessionMigrate) TableName() string { return "upload_sessions" }

// setupSessionTestDB 初始化 SQLite 临时文件库并迁移 upload_sessions 表。
func setupSessionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(tmpFile), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&uploadSessionMigrate{}))
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

// newUploadSession 构造一个 active 状态、3 分片的上传会话。
func newUploadSession(t *testing.T) *upload.UploadSession {
	t.Helper()
	s, err := upload.NewUploadSession(
		shared.NewID(), shared.NewID(),
		"test.png", 1024*1024, "image/png",
		"sha256-abcdef", "material", 512*1024, 3,
	)
	require.NoError(t, err)
	return s
}

// TestUploadSession_SaveAndFindByID 新建会话存盘后按 ID 查回，验证全部字段（含 chunks 空数组）。
func TestUploadSession_SaveAndFindByID(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	s := newUploadSession(t)
	require.NoError(t, repo.Save(ctx, s))

	got, err := repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, s.ID(), got.ID())
	assert.Equal(t, s.UserID(), got.UserID())
	assert.Equal(t, "test.png", got.FileName())
	assert.Equal(t, int64(1024*1024), got.FileSize())
	assert.Equal(t, "image/png", got.MimeType())
	assert.Equal(t, "sha256-abcdef", got.FileHash())
	assert.Equal(t, "material", got.Purpose())
	assert.Equal(t, 512*1024, got.ChunkSize())
	assert.Equal(t, 3, got.TotalChunks())
	assert.Equal(t, upload.SessionActive, got.Status())
	assert.Equal(t, []int{}, got.UploadedChunks(), "新建会话 uploaded_chunks 应为空数组而非 nil")
	assert.NotZero(t, got.ExpiresAt())
}

// TestUploadSession_FindByHash 按 hash+userID 查询；状态非 active 或不匹配均 NotFound。
func TestUploadSession_FindByHash(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	s := newUploadSession(t)
	require.NoError(t, repo.Save(ctx, s))

	// 正确 hash + userID → 找到
	got, err := repo.FindByHash(ctx, s.FileHash(), s.UserID())
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, s.ID(), got.ID())

	// 错误 hash → NotFound
	got, err = repo.FindByHash(ctx, "wrong-hash", s.UserID())
	require.ErrorIs(t, err, upload.ErrSessionNotFound)
	assert.Nil(t, got)

	// 错误 userID → NotFound
	got, err = repo.FindByHash(ctx, s.FileHash(), shared.NewID())
	require.ErrorIs(t, err, upload.ErrSessionNotFound)
	assert.Nil(t, got)
}

// TestUploadSession_UpdateStatus_CAS 状态匹配才更新：oldStatus 匹配→true，不匹配→false。
func TestUploadSession_UpdateStatus_CAS(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	s := newUploadSession(t)
	require.NoError(t, repo.Save(ctx, s))
	require.Equal(t, upload.SessionActive, s.Status())

	// oldStatus=active 匹配 → 成功，转 merging
	ok, err := repo.UpdateStatus(ctx, s.ID(), upload.SessionActive, upload.SessionMerging)
	require.NoError(t, err)
	assert.True(t, ok)

	got, err := repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, upload.SessionMerging, got.Status())

	// oldStatus=active 不再匹配（已 merging）→ false，状态不变
	ok, err = repo.UpdateStatus(ctx, s.ID(), upload.SessionActive, upload.SessionCompleted)
	require.NoError(t, err)
	assert.False(t, ok, "oldStatus 不匹配应返回 false")

	got, err = repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, upload.SessionMerging, got.Status(), "CAS 失败不应改变状态")
}

// TestUploadSession_AppendChunk 追加分片：乱序排序、重复去重。
func TestUploadSession_AppendChunk(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	s := newUploadSession(t) // totalChunks=3
	require.NoError(t, repo.Save(ctx, s))

	// 乱序追加 → 排序存储
	require.NoError(t, repo.AppendChunk(ctx, s.ID(), 2))
	require.NoError(t, repo.AppendChunk(ctx, s.ID(), 0))

	got, err := repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, []int{0, 2}, got.UploadedChunks())

	// 幂等：重复追加 2 不变
	require.NoError(t, repo.AppendChunk(ctx, s.ID(), 2))
	got, err = repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, []int{0, 2}, got.UploadedChunks(), "重复分片应去重")

	// 追加 1 → 全集，会话完成
	require.NoError(t, repo.AppendChunk(ctx, s.ID(), 1))
	got, err = repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	assert.Equal(t, []int{0, 1, 2}, got.UploadedChunks())
	assert.True(t, got.IsComplete())
}

// TestUploadSession_Delete 删除后 FindByID 返回 ErrSessionNotFound。
func TestUploadSession_Delete(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	s := newUploadSession(t)
	require.NoError(t, repo.Save(ctx, s))

	got, err := repo.FindByID(ctx, s.ID())
	require.NoError(t, err)
	require.NotNil(t, got)

	require.NoError(t, repo.Delete(ctx, s.ID()))

	got, err = repo.FindByID(ctx, s.ID())
	require.ErrorIs(t, err, upload.ErrSessionNotFound)
	assert.Nil(t, got)
}

// TestUploadSession_DeleteExpired 仅清理过期且未完成的会话。
func TestUploadSession_DeleteExpired(t *testing.T) {
	db := setupSessionTestDB(t)
	repo := NewUploadSessionRepository(db)
	ctx := context.Background()

	now := time.Now()
	past := now.Add(-1 * time.Hour)
	future := now.Add(1 * time.Hour)

	reconstruct := func(hash, status string, expiresAt time.Time) *upload.UploadSession {
		return upload.ReconstructUploadSession(
			shared.NewID(), shared.NewID(), "f.png", 100, "image/png",
			hash, "material", 100, 1, []int{}, status, "", expiresAt, now, now,
		)
	}

	// 过期 + active → 应删
	expired := reconstruct("hash-expired", upload.SessionActive, past)
	require.NoError(t, repo.Save(ctx, expired))
	// 未过期 + active → 保留
	valid := reconstruct("hash-valid", upload.SessionActive, future)
	require.NoError(t, repo.Save(ctx, valid))
	// 过期但 completed → 保留（status != completed 才删）
	completed := reconstruct("hash-completed", upload.SessionCompleted, past)
	require.NoError(t, repo.Save(ctx, completed))

	require.NoError(t, repo.DeleteExpired(ctx))

	// expired 已删
	_, err := repo.FindByID(ctx, expired.ID())
	assert.ErrorIs(t, err, upload.ErrSessionNotFound)

	// valid 保留
	got, err := repo.FindByID(ctx, valid.ID())
	require.NoError(t, err)
	require.NotNil(t, got)

	// completed 保留
	got, err = repo.FindByID(ctx, completed.ID())
	require.NoError(t, err)
	require.NotNil(t, got)
}
