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
	userID, conversationID domainshared.ID,
	files ...*domainupload.File,
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
	fileRepo := &mockFileRepo{files: map[domainshared.ID]*domainupload.File{}}
	for _, file := range files {
		fileRepo.files[file.ID()] = file
	}
	svc := NewService(repo, users, fileRepo, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil)
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
	svc, repo := newImageCaptionService(t, userID, conversationID, newChatImageFile(t, mediaID, userID))

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        "  快来看这张图  ",
		MediaIDs:       []domainshared.ID{mediaID},
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
	if ids := repo.saved.MediaIDs(); len(ids) != 1 || !ids[0].Equal(mediaID) {
		t.Fatalf("saved media ids = %v, want [%s]", ids, mediaID)
	}
	if got.Content != "快来看这张图" {
		t.Fatalf("dto content = %q, want trimmed caption", got.Content)
	}
	if len(got.Media) != 1 {
		t.Fatalf("dto media len = %d, want 1", len(got.Media))
	}
}

// TestSendMessageMultiImage 回归：一条图片消息可携带多张图片，媒体顺序与 DTO 一一对应。
func TestSendMessageMultiImage(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaA := domainshared.NewID()
	mediaB := domainshared.NewID()
	svc, repo := newImageCaptionService(t, userID, conversationID,
		newChatImageFile(t, mediaA, userID), newChatImageFile(t, mediaB, userID))

	content := "看![img:" + mediaA.String() + "]和![img:" + mediaB.String() + "]"
	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        content,
		MediaIDs:       []domainshared.ID{mediaA, mediaB},
		IdempotencyKey: "image-multi-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	ids := repo.saved.MediaIDs()
	if len(ids) != 2 || !ids[0].Equal(mediaA) || !ids[1].Equal(mediaB) {
		t.Fatalf("saved media ids = %v, want [%s %s]", ids, mediaA, mediaB)
	}
	if len(got.Media) != 2 || got.Media[0].ID != mediaA.String() || got.Media[1].ID != mediaB.String() {
		t.Fatalf("dto media = %v, want media-a/media-b in order", got.Media)
	}
}

func TestSendMessageRejectsEmptyImageMedia(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	svc, _ := newImageCaptionService(t, userID, conversationID)

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		IdempotencyKey: "image-multi-2",
	})
	if err == nil {
		t.Fatal("expected error for image message without media")
	}
}

func TestSendMessageAllowsImageWithoutCaption(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaID := domainshared.NewID()
	svc, repo := newImageCaptionService(t, userID, conversationID, newChatImageFile(t, mediaID, userID))

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		MediaIDs:       []domainshared.ID{mediaID},
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
	svc, repo := newImageCaptionService(t, userID, conversationID, newChatImageFile(t, mediaID, userID))

	image, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        "看![img:" + mediaID.String() + "]图",
		MediaIDs:       []domainshared.ID{mediaID},
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

// TestReferencePreviewStripsEmojiTokens 回归：自定义表情占位符 [name:uuid]（含系统表情
// [name]）与图片占位符同形（都是方括号包裹），引用预览没有 custom_emote 解析结果可查，
// 裸吐 token 文本不可读，必须一并剥离（见 messageReferenceDTO/stripChatEmojiTokens）。
func TestReferencePreviewStripsEmojiTokens(t *testing.T) {
	conversationID := domainshared.NewID()
	userID := domainshared.NewID()
	mediaID := domainshared.NewID()
	svc, repo := newImageCaptionService(t, userID, conversationID, newChatImageFile(t, mediaID, userID))

	image, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID:         userID,
		ConversationID: conversationID,
		Type:           domainchat.MessageImage,
		Content:        "看[1:" + domainshared.NewID().String() + "]图",
		MediaIDs:       []domainshared.ID{mediaID},
		IdempotencyKey: "image-caption-5",
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
		IdempotencyKey: "image-caption-6",
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply.ReplyTo == nil {
		t.Fatal("expected reply preview")
	}
	if reply.ReplyTo.Content != "看图" {
		t.Fatalf("reference preview = %q, want emoji token stripped", reply.ReplyTo.Content)
	}
}
