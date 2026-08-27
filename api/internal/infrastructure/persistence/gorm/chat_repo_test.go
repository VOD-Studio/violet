package gorm

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

func TestChatRepositoryUpdateMessageReplacesContentAndMedia(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChatMessage{}, &model.ChatMessageMedia{}))
	repo := NewChatRepository(db)
	ctx := context.Background()

	messageID := uuid.New()
	conversationID := uuid.New()
	senderID := uuid.New()
	mediaA := uuid.New()
	mediaB := uuid.New()
	mediaC := uuid.New()
	require.NoError(t, db.Create(&model.ChatMessage{
		ID: messageID, ConversationID: conversationID, SenderID: senderID, MessageType: "image",
		Content: "旧说明", IdempotencyKey: "update-1", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}).Error)
	require.NoError(t, db.Create(&[]model.ChatMessageMedia{
		{MessageID: messageID, MediaID: mediaA, Position: 0},
		{MessageID: messageID, MediaID: mediaB, Position: 1},
	}).Error)

	message, err := repo.FindMessage(ctx, domainshared.IDFromUUID(conversationID), domainshared.IDFromUUID(messageID))
	require.NoError(t, err)
	require.Len(t, message.MediaIDs(), 2)

	editedAt := time.Now().Add(time.Hour)
	require.NoError(t, message.Edit("新说明", []domainshared.ID{domainshared.IDFromUUID(mediaA), domainshared.IDFromUUID(mediaC)}, editedAt))
	require.NoError(t, repo.UpdateMessage(ctx, message))

	reloaded, err := repo.FindMessage(ctx, domainshared.IDFromUUID(conversationID), domainshared.IDFromUUID(messageID))
	require.NoError(t, err)
	require.Equal(t, "新说明", reloaded.Content())
	require.Equal(t, []domainshared.ID{domainshared.IDFromUUID(mediaA), domainshared.IDFromUUID(mediaC)}, reloaded.MediaIDs())
	require.NotNil(t, reloaded.EditedAt())
}
