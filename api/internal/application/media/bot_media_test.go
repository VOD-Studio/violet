package media

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/storage"
)

type botMediaRepo struct {
	fakeFileRepo
	saved *domainupload.File
}

func (r *botMediaRepo) Save(_ context.Context, file *domainupload.File) error {
	r.saved = file
	return nil
}

func TestSaveBotMedia(t *testing.T) {
	tmp := t.TempDir()
	repo := &botMediaRepo{}
	svc := NewUploadService(repo, nil, storage.NewLocalStorage(tmp, "/uploads/"), nil, filepath.Join(tmp, "chunks"), tmp, "/uploads/")
	ownerID := domainshared.NewID()
	data := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

	got, err := svc.SaveBotMedia(context.Background(), SaveBotMediaInput{
		OwnerID: ownerID, OriginalName: "../../avatar.png", MIMEType: "image/png", Data: data,
	})
	if err != nil {
		t.Fatalf("SaveBotMedia() error = %v", err)
	}
	if repo.saved == nil || repo.saved.Purpose() != domainupload.PurposeChat || !repo.saved.OwnerID().Equal(ownerID) {
		t.Fatalf("saved file = %#v", repo.saved)
	}
	if got.ID != repo.saved.ID().String() || got.MIMEType != "image/png" || got.Size != int64(len(data)) {
		t.Fatalf("result = %#v", got)
	}
	if !strings.HasPrefix(got.URL, "/uploads/chat/") || strings.Contains(got.URL, "avatar") {
		t.Fatalf("url = %q", got.URL)
	}
	rel := strings.TrimPrefix(got.URL, "/uploads/")
	if _, err := os.Stat(filepath.Join(tmp, filepath.FromSlash(rel))); err != nil {
		t.Fatalf("stat saved image: %v", err)
	}
}

func TestSaveBotMediaRejectsMIMEOrContentMismatch(t *testing.T) {
	tmp := t.TempDir()
	repo := &botMediaRepo{}
	svc := NewUploadService(repo, nil, storage.NewLocalStorage(tmp, "/uploads/"), nil, filepath.Join(tmp, "chunks"), tmp, "/uploads/")

	for _, tc := range []struct {
		name     string
		mimeType string
		data     []byte
	}{
		{name: "unsupported", mimeType: "text/plain", data: []byte("hello")},
		{name: "mismatch", mimeType: "image/jpeg", data: []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.SaveBotMedia(context.Background(), SaveBotMediaInput{
				OwnerID: domainshared.NewID(), MIMEType: tc.mimeType, Data: tc.data,
			})
			if err == nil {
				t.Fatal("expected error")
			}
		})
	}
	if repo.saved != nil {
		t.Fatal("rejected media must not be saved")
	}
}
