package media

import (
	"bytes"
	"context"
	"image"
	"image/gif"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/storage"
)

func TestSaveBotAvatarPersistsOriginalSupportedImages(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2, 3))
	var jpegData, gifData bytes.Buffer
	require.NoError(t, jpeg.Encode(&jpegData, img, nil))
	require.NoError(t, gif.Encode(&gifData, img, nil))
	for _, tc := range []struct {
		name, mime string
		data       []byte
	}{
		{"PNG", "image/png", validPNG(t)},
		{"JPEG", "image/jpeg", jpegData.Bytes()},
		{"GIF", "image/gif", gifData.Bytes()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			repo := &botMediaRepo{}
			svc := NewUploadService(repo, nil, storage.NewLocalStorage(dir, "/uploads/"), nil, filepath.Join(dir, "chunks"), dir, "/uploads/")
			owner := domainshared.NewID()
			dto, err := svc.SaveBotAvatar(context.Background(), SaveBotMediaInput{OwnerID: owner, Data: tc.data, MIMEType: tc.mime, OriginalName: "avatar"})
			require.NoError(t, err)
			require.Equal(t, domainupload.PurposeAvatar, repo.saved.Purpose())
			require.Equal(t, owner, repo.saved.OwnerID())
			require.Equal(t, domainupload.StatusReady, repo.saved.Status())
			require.Equal(t, tc.mime, dto.MIMEType)
			require.Contains(t, dto.URL, "/uploads/avatar/")
			stored, err := os.ReadFile(repo.saved.Path())
			require.NoError(t, err)
			require.Equal(t, tc.data, stored)
		})
	}
}

func TestSaveBotAvatarRejectsInvalidInputWithoutSaving(t *testing.T) {
	owner := domainshared.NewID()
	for _, tc := range []SaveBotMediaInput{
		{OwnerID: owner, MIMEType: "image/png"},
		{OwnerID: owner, MIMEType: "image/png", Data: make([]byte, (10<<20)+1)},
		{MIMEType: "image/png", Data: validPNG(t)},
		{OwnerID: owner, MIMEType: "image/jpeg", Data: validPNG(t)},
		{OwnerID: owner, MIMEType: "image/svg+xml", Data: []byte("<svg/>")},
	} {
		dir := t.TempDir()
		repo := &botMediaRepo{}
		svc := NewUploadService(repo, nil, storage.NewLocalStorage(dir, "/uploads/"), nil, filepath.Join(dir, "chunks"), dir, "/uploads/")
		_, err := svc.SaveBotAvatar(context.Background(), tc)
		require.Error(t, err)
		require.Nil(t, repo.saved)
	}
}
