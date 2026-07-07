package upload

import (
	"testing"

	domainshared "blog-api/internal/domain/shared"
)

func TestFile_ReplaceStoredFile(t *testing.T) {
	ownerID := domainshared.NewID()
	fid := domainshared.NewID()
	f, err := NewFile(fid, ownerID, "material", "orig.jpg", "/old/path.jpg", "/uploads/old.jpg", 100, "image/jpeg", "oldhash")
	if err != nil {
		t.Fatalf("NewFile: %v", err)
	}
	w, h := 800, 600
	f.ReplaceStoredFile("/new/path.webp", "/uploads/new.webp", 50, "image/webp", "newhash", &w, &h, "/uploads/new_thumb.jpg")

	if f.Path() != "/new/path.webp" {
		t.Errorf("Path = %q, want /new/path.webp", f.Path())
	}
	if f.URL() != "/uploads/new.webp" {
		t.Errorf("URL = %q, want /uploads/new.webp", f.URL())
	}
	if f.Size() != 50 {
		t.Errorf("Size = %d, want 50", f.Size())
	}
	if f.MimeType() != "image/webp" {
		t.Errorf("MimeType = %q, want image/webp", f.MimeType())
	}
	if f.FileHash() != "newhash" {
		t.Errorf("FileHash = %q, want newhash", f.FileHash())
	}
	if f.Width() == nil || *f.Width() != 800 || f.Height() == nil || *f.Height() != 600 {
		t.Errorf("dims = %v/%v, want 800/600", f.Width(), f.Height())
	}
	if f.Thumbnail() != "/uploads/new_thumb.jpg" {
		t.Errorf("Thumbnail = %q", f.Thumbnail())
	}
	// 不变字段:ReplaceStoredFile 不应触碰 id/owner/purpose/refCount/originalName
	if f.ID() != fid || f.OwnerID() != ownerID || f.Purpose() != "material" {
		t.Error("ReplaceStoredFile 误改了 id/owner/purpose")
	}
	if f.RefCount() != 0 || f.OriginalName() != "orig.jpg" {
		t.Error("ReplaceStoredFile 误改了 refCount/originalName")
	}
}
