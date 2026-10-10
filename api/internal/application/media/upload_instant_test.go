package media

import (
	"context"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

type instantFileRepo struct {
	fakeFileRepo
	file *domainupload.File
}

func (r *instantFileRepo) FindByHash(_ context.Context, hash string, ownerID domainshared.ID) (*domainupload.File, error) {
	if r.file.FileHash() != hash || !r.file.OwnerID().Equal(ownerID) || r.file.Status() != domainupload.StatusReady {
		return nil, domainupload.ErrFileNotFound
	}
	return r.file, nil
}

func (r *instantFileRepo) Save(_ context.Context, file *domainupload.File) error {
	r.file = file
	return nil
}

type deniedInstantStorage struct{ realDirStorage }

func (deniedInstantStorage) FileSize(string) (int64, error) {
	return 0, os.ErrPermission
}

func instantFile(t *testing.T, present bool) (*instantFileRepo, string) {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "cover.png")
	if present {
		file, err := os.Create(path)
		require.NoError(t, err)
		require.NoError(t, png.Encode(file, image.NewRGBA(image.Rect(0, 0, 2, 2))))
		require.NoError(t, file.Close())
	}
	file, err := domainupload.NewFile(domainshared.NewID(), domainshared.NewID(), domainupload.PurposeMaterial, "cover.png", path, "/uploads/cover.png", 100, "image/png", "same-image-hash")
	require.NoError(t, err)
	return &instantFileRepo{file: file}, dir
}

func TestInstantUploadMissingFileRequiresUpload(t *testing.T) {
	for _, entry := range []string{"initialize", "check"} {
		t.Run(entry, func(t *testing.T) {
			repo, dir := instantFile(t, false)
			svc := NewUploadService(repo, &ownerMismatchSessionRepo{}, realDirStorage{}, nil, dir, dir, "/uploads/")
			if entry == "initialize" {
				result, err := svc.InitSession(context.Background(), InitSessionInput{
					UserID: repo.file.OwnerID().String(), FileName: "cover.png", FileSize: 100,
					FileHash: repo.file.FileHash(), Purpose: domainupload.PurposeMaterial,
				})
				require.NoError(t, err)
				require.False(t, result.Instant, "缺失的物理文件不能命中秒传")
				require.Empty(t, result.URL, "不能返回失效的旧资源地址")
			} else {
				file, exists, err := svc.CheckInstantUpload(context.Background(), repo.file.FileHash(), repo.file.OwnerID().String())
				require.NoError(t, err)
				require.False(t, exists)
				require.Nil(t, file)
			}
			file, exists, err := svc.CheckInstantUpload(context.Background(), repo.file.FileHash(), repo.file.OwnerID().String())
			require.NoError(t, err)
			require.False(t, exists, "后续查询不能继续命中已丢失的文件")
			require.Nil(t, file)
		})
	}
}

func TestInstantUploadExistingFileRemainsReusable(t *testing.T) {
	repo, dir := instantFile(t, true)
	svc := NewUploadService(repo, nil, realDirStorage{}, nil, dir, dir, "/uploads/")
	result, err := svc.InitSession(context.Background(), InitSessionInput{
		UserID: repo.file.OwnerID().String(), FileName: "cover.png", FileSize: 100,
		FileHash: repo.file.FileHash(), Purpose: domainupload.PurposeMaterial,
	})
	require.NoError(t, err)
	require.True(t, result.Instant)
	require.Equal(t, repo.file.URL(), result.URL)
	file, exists, err := svc.CheckInstantUpload(context.Background(), repo.file.FileHash(), repo.file.OwnerID().String())
	require.NoError(t, err)
	require.True(t, exists)
	require.Equal(t, result.URL, file.URL)
}

func TestInstantUploadReadFailureIsNotCacheMiss(t *testing.T) {
	repo, dir := instantFile(t, true)
	svc := NewUploadService(repo, nil, deniedInstantStorage{}, nil, dir, dir, "/uploads/")
	result, err := svc.InitSession(context.Background(), InitSessionInput{
		UserID: repo.file.OwnerID().String(), FileName: "cover.png", FileSize: 100,
		FileHash: repo.file.FileHash(), Purpose: domainupload.PurposeMaterial,
	})
	require.True(t, domainshared.IsDomainError(err, domainshared.CodeInternal))
	require.Nil(t, result)
	file, exists, err := svc.CheckInstantUpload(context.Background(), repo.file.FileHash(), repo.file.OwnerID().String())
	require.True(t, domainshared.IsDomainError(err, domainshared.CodeInternal))
	require.False(t, exists)
	require.Nil(t, file)
	require.Equal(t, domainupload.StatusReady, repo.file.Status())
}
