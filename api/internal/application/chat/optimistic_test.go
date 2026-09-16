package chat

import (
	"context"
	"testing"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

func TestMessageClientIDOnlyVisibleToSender(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newImageCaptionService(t, userID, conversationID)
	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageText,
		Content: "hello", IdempotencyKey: "client-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.ClientMessageID != "client-1" {
		t.Fatalf("client ID = %q", got.ClientMessageID)
	}
	for _, viewer := range []domainshared.ID{userID, domainshared.NewID()} {
		dto, err := svc.messageDTOWithReactions(context.Background(), repo.saved, nil, viewer)
		if err != nil {
			t.Fatal(err)
		}
		want := ""
		if viewer.Equal(userID) {
			want = "client-1"
		}
		if dto.ClientMessageID != want {
			t.Fatalf("client ID = %q, want %q", dto.ClientMessageID, want)
		}
	}
}
