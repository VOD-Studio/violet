package chat_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/chat"
	"blog-api/internal/domain/shared"
)

func TestNewConversationValidatesRoomTitle(t *testing.T) {
	now := time.Date(2026, 8, 20, 10, 0, 0, 0, time.UTC)
	owner := shared.NewID()

	room, err := chat.NewConversation(chat.ConversationRoom, owner, " Violet Core ", now)
	require.NoError(t, err)
	require.Equal(t, "Violet Core", room.Title())
	require.Equal(t, chat.ConversationRoom, room.Kind())
	require.False(t, room.ID().IsZero())
	member, memberErr := chat.NewMember(room.ID(), shared.NewID(), chat.MemberMember, now)
	require.NoError(t, memberErr)
	require.NotNil(t, member)

	_, err = chat.NewConversation(chat.ConversationRoom, owner, "   ", now)
	require.Error(t, err)
}

func TestMessageFactoriesEnforcePayloadShapeAndIdempotency(t *testing.T) {
	now := time.Now()
	conversationID := shared.NewID()
	senderID := shared.NewID()

	text, err := chat.NewTextMessage(conversationID, senderID, " hello ", "retry-1", now)
	require.NoError(t, err)
	require.Equal(t, "hello", text.Content())
	require.Equal(t, chat.MessageText, text.Type())

	_, err = chat.NewTextMessage(conversationID, senderID, "", "retry-2", now)
	require.Error(t, err)
	_, err = chat.NewTextMessage(conversationID, senderID, "hello", "", now)
	require.Error(t, err)

	image, err := chat.NewImageMessage(conversationID, senderID, shared.NewID(), "retry-3", now)
	require.NoError(t, err)
	require.Equal(t, chat.MessageImage, image.Type())
	require.NotNil(t, image.MediaID())
}

func TestSystemMessageFactory(t *testing.T) {
	message, err := chat.NewSystemMessage(
		shared.NewID(),
		shared.NewID(),
		" Alice 加入了群聊 ",
		"system-1",
		time.Now(),
	)
	require.NoError(t, err)
	require.Equal(t, chat.MessageSystem, message.Type())
	require.Equal(t, "Alice 加入了群聊", message.Content())
	require.Nil(t, message.MediaID())
}

func TestMessageDeleteIsOneWay(t *testing.T) {
	message, err := chat.NewTextMessage(shared.NewID(), shared.NewID(), "moderate me", "retry-1", time.Now())
	require.NoError(t, err)
	adminID := shared.NewID()

	require.NoError(t, message.Delete(adminID, time.Now()))
	require.NotNil(t, message.DeletedAt())
	require.Equal(t, adminID, *message.DeletedBy())
	require.Error(t, message.Delete(adminID, time.Now()))
}
