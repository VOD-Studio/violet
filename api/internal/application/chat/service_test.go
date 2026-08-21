package chat

import (
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	"context"
	"strings"
	"testing"
)

type mockFileRepo struct {
	files map[domainshared.ID]*domainupload.File
}

func (m *mockFileRepo) FindByID(_ context.Context, id domainshared.ID) (*domainupload.File, error) {
	if f, ok := m.files[id]; ok {
		return f, nil
	}
	return nil, domainshared.NotFound("file not found")
}

func (m *mockFileRepo) UpdateRefCount(_ context.Context, _ domainshared.ID, _ int) error {
	return nil
}

func TestGeneratedRoomTitle(t *testing.T) {
	t.Run("joins participant display names", func(t *testing.T) {
		if got := generatedRoomTitle([]string{"Alice", "Bob"}); got != "Alice、Bob" {
			t.Fatalf("generatedRoomTitle() = %q, want %q", got, "Alice、Bob")
		}
	})

	t.Run("truncates long names without splitting Unicode", func(t *testing.T) {
		got := generatedRoomTitle([]string{strings.Repeat("你", 90)})
		if len([]rune(got)) != domainchat.MaxRoomTitleLength {
			t.Fatalf("generatedRoomTitle() rune length = %d, want %d", len([]rune(got)), domainchat.MaxRoomTitleLength)
		}
		if !strings.HasSuffix(got, "…") {
			t.Fatalf("generatedRoomTitle() = %q, want ellipsis suffix", got)
		}
	})
}

func TestChatImagePurposeValidation(t *testing.T) {
	userID := domainshared.NewID()
	otherUserID := domainshared.NewID()

	validPurposes := []string{
		domainupload.PurposeChat,
		domainupload.PurposeMaterial,
		domainupload.PurposePost,
		domainupload.PurposeTweet,
		"comment",
		domainupload.PurposeEmoji,
	}

	for _, purpose := range validPurposes {
		t.Run("valid purpose: "+purpose, func(t *testing.T) {
			fileID := domainshared.NewID()
			file, err := domainupload.NewFile(fileID, userID, purpose, "test.png", "/path/test.png", "http://example.com/test.png", 1024, "image/png", "hash123")
			if err != nil {
				t.Fatalf("failed to create file: %v", err)
			}
			repo := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{fileID: file}}
			svc := NewService(nil, nil, repo, nil, nil, "", nil, nil, nil, nil)

			res, err := svc.chatImage(context.Background(), fileID, userID)
			if err != nil {
				t.Fatalf("expected chatImage to succeed for purpose %s, got %v", purpose, err)
			}
			if res.ID() != fileID {
				t.Fatalf("expected file ID %s, got %s", fileID, res.ID())
			}
		})
	}

	t.Run("forbidden for other user file", func(t *testing.T) {
		fileID := domainshared.NewID()
		file, err := domainupload.NewFile(fileID, otherUserID, domainupload.PurposeChat, "test.png", "/path/test.png", "http://example.com/test.png", 1024, "image/png", "hash123")
		if err != nil {
			t.Fatalf("failed to create file: %v", err)
		}
		repo := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{fileID: file}}
		svc := NewService(nil, nil, repo, nil, nil, "", nil, nil, nil, nil)

		_, err = svc.chatImage(context.Background(), fileID, userID)
		if err == nil {
			t.Fatal("expected forbidden error for other user file, got nil")
		}
	})

	t.Run("forbidden for avatar purpose", func(t *testing.T) {
		fileID := domainshared.NewID()
		file, err := domainupload.NewFile(fileID, userID, domainupload.PurposeAvatar, "avatar.png", "/path/avatar.png", "http://example.com/avatar.png", 1024, "image/png", "hash123")
		if err != nil {
			t.Fatalf("failed to create file: %v", err)
		}
		repo := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{fileID: file}}
		svc := NewService(nil, nil, repo, nil, nil, "", nil, nil, nil, nil)

		_, err = svc.chatImage(context.Background(), fileID, userID)
		if err == nil {
			t.Fatal("expected forbidden error for avatar purpose, got nil")
		}
	})

	t.Run("forbidden for non-image file", func(t *testing.T) {
		fileID := domainshared.NewID()
		file, err := domainupload.NewFile(fileID, userID, domainupload.PurposeChat, "doc.pdf", "/path/doc.pdf", "http://example.com/doc.pdf", 1024, "application/pdf", "hash123")
		if err != nil {
			t.Fatalf("failed to create file: %v", err)
		}
		repo := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{fileID: file}}
		svc := NewService(nil, nil, repo, nil, nil, "", nil, nil, nil, nil)

		_, err = svc.chatImage(context.Background(), fileID, userID)
		if err == nil {
			t.Fatal("expected forbidden error for non-image file, got nil")
		}
	})
}
