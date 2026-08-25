package chat

import (
	"context"
	"testing"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
)

func newImageCaptionService(
	t *testing.T,
	file *domainupload.File,
	userID, conversationID domainshared.ID,
) (*Service, *replyChatRepo) {
	t.Helper()
	now := time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC)
	conversation, err := domainchat.NewConversation(domainchat.ConversationDirect, userID, "", now)
	if err != nil {
		t.Fatal(err)
	}
	member, err := domainchat.NewMember(conversationID, userID, domainchat.MemberOwner, now)
	if err != nil {
		t.Fatal(err)
	}
	repo := &replyChatRepo{conversation: conversation, member: member}
	users := &replyUserRepo{users: map[domainshared.ID]*domainuser.User{userID: newReplyUser(userID, "alice")}}
	files := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{file.ID(): file}}
	svc := NewService(repo, users, files, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
	return svc, repo
}

func newChatImageFile(t *testing.T, mediaID, ownerID domainshared.ID) *domainupload.File {
	t.Helper()
	file, err := domainupload.NewFile(
		mediaID, ownerID, domainupload.PurposeChat,
		"photo.png", "path/photo.png", "https://cdn.example.com/photo.png",
		1024, "image/png", "hash",
	)
	if err != nil {
		t.Fatal(err)
	}
	return file
}

func TestSendMessageIncludesImageCaption(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaID := domainshared.NewID()
	svc, repo := newImageCaptionService(t, newChatImageFile(t, mediaID, userID), userID, conversationID)

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        "  快来看这张图  ",
		MediaID:        mediaID,
		IdempotencyKey: "image-caption-1",
	})
	if err != nil {
		t.Fatal(err)
	}

	if repo.saved == nil {
		t.Fatal("expected message to be saved")
	}
	if repo.saved.Content() != "快来看这张图" {
		t.Fatalf("saved content = %q, want trimmed caption", repo.saved.Content())
	}
	if repo.saved.MediaID() == nil || !repo.saved.MediaID().Equal(mediaID) {
		t.Fatalf("saved media id = %v, want %s", repo.saved.MediaID(), mediaID)
	}
	if got.Content != "快来看这张图" {
		t.Fatalf("dto content = %q, want trimmed caption", got.Content)
	}
	if got.Media == nil {
		t.Fatal("expected dto to include media alongside caption")
	}
}

func TestSendMessageAllowsImageWithoutCaption(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaID := domainshared.NewID()
	svc, repo := newImageCaptionService(t, newChatImageFile(t, mediaID, userID), userID, conversationID)

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		MediaID:        mediaID,
		IdempotencyKey: "image-caption-2",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.saved.Content() != "" {
		t.Fatalf("saved content = %q, want empty (existing behavior unchanged)", repo.saved.Content())
	}
	if got.Content != "" {
		t.Fatalf("dto content = %q, want empty (existing behavior unchanged)", got.Content)
	}
}

func TestReferencePreviewStripsImageTokens(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaID := domainshared.NewID()
	svc, repo := newImageCaptionService(t, newChatImageFile(t, mediaID, userID), userID, conversationID)

	image, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        "看![img:" + mediaID.String() + "]图",
		MediaID:        mediaID,
		IdempotencyKey: "image-caption-3",
	})
	if err != nil {
		t.Fatal(err)
	}
	repo.target = repo.saved
	imageID, err := domainshared.ParseID(image.ID)
	if err != nil {
		t.Fatal(err)
	}

	reply, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageText,
		Content:        "收到",
		ReplyToID:      imageID,
		IdempotencyKey: "image-caption-4",
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply.ReplyTo == nil {
		t.Fatal("expected reply preview")
	}
	if reply.ReplyTo.Content != "看图" {
		t.Fatalf("reference preview = %q, want image tokens stripped", reply.ReplyTo.Content)
	}
}
