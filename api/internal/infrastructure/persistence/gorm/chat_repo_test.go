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

	domainchat "blog-api/internal/domain/chat"
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

// 已读回执的数据基础：阅读位置查询与成员水位列表。
func TestChatRepositoryReadPositions(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.ChatMessage{}, &model.ChatConversationMember{}, &model.ChatReadPosition{}))
	repo := NewChatRepository(db)
	ctx := context.Background()

	conversationID := domainshared.NewID()
	userA := domainshared.NewID()
	userB := domainshared.NewID()
	userC := domainshared.NewID()
	now := time.Now().UTC()
	leftAt := now.Add(-time.Hour)
	require.NoError(t, db.Create(&[]model.ChatConversationMember{
		{ConversationID: conversationID.UUID(), UserID: userA.UUID(), Role: "member", JoinedAt: now.Add(-2 * time.Hour)},
		{ConversationID: conversationID.UUID(), UserID: userB.UUID(), Role: "member", JoinedAt: now.Add(-2 * time.Hour)},
		{ConversationID: conversationID.UUID(), UserID: userC.UUID(), Role: "member", JoinedAt: now.Add(-2 * time.Hour), LeftAt: &leftAt},
	}).Error)

	t1 := now.Add(-30 * time.Minute)
	t2 := now.Add(-20 * time.Minute)
	m1 := domainshared.NewID()
	m2 := domainshared.NewID()
	for _, seed := range []struct {
		id domainshared.ID
		at time.Time
	}{{m1, t1}, {m2, t2}} {
		require.NoError(t, db.Create(&model.ChatMessage{
			ID: seed.id.UUID(), ConversationID: conversationID.UUID(), SenderID: userA.UUID(),
			MessageType: "text", Content: "hi", IdempotencyKey: "k-" + seed.id.String(),
			CreatedAt: seed.at, UpdatedAt: seed.at,
		}).Error)
	}

	// A 读到 m1；C 读到 m2 后离开会话。
	readAtA := now.Add(-10 * time.Minute)
	_, err = repo.SaveReadPosition(ctx, domainchat.ReconstructReadPosition(conversationID, userA, &m1, &readAtA))
	require.NoError(t, err)
	_, err = repo.SaveReadPosition(ctx, domainchat.ReconstructReadPosition(conversationID, userC, &m2, &now))
	require.NoError(t, err)

	pos, err := repo.FindReadPosition(ctx, conversationID, userA)
	require.NoError(t, err)
	require.NotNil(t, pos)
	require.NotNil(t, pos.LastMessageID())
	require.True(t, pos.LastMessageID().Equal(m1))

	missing, err := repo.FindReadPosition(ctx, conversationID, userB)
	require.NoError(t, err)
	require.Nil(t, missing)

	states, err := repo.ListMemberReadStates(ctx, conversationID)
	require.NoError(t, err)
	require.Len(t, states, 2)
	byUser := make(map[domainshared.ID]domainchat.MemberReadState, len(states))
	for _, state := range states {
		byUser[state.UserID] = state
	}
	require.NotNil(t, byUser[userA].LastReadAt)
	require.WithinDuration(t, t1, *byUser[userA].LastReadAt, time.Second)
	require.NotNil(t, byUser[userA].ReadAt)
	require.Nil(t, byUser[userB].LastReadAt)
	require.Nil(t, byUser[userB].ReadAt)
	_, excluded := byUser[userC]
	require.False(t, excluded)
}

func TestChatRepositoryReadPositionDoesNotRegress(t *testing.T) {
	for _, gap := range []time.Duration{0, time.Minute} {
		t.Run(gap.String(), func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
			require.NoError(t, err)
			require.NoError(t, db.AutoMigrate(&model.ChatMessage{}, &model.ChatReadPosition{}))
			repo := NewChatRepository(db)
			ctx := context.Background()
			conversationID, userID := domainshared.NewID(), domainshared.NewID()
			older := domainshared.IDFromUUID(uuid.MustParse("00000000-0000-0000-0000-000000000001"))
			newer := domainshared.IDFromUUID(uuid.MustParse("00000000-0000-0000-0000-000000000002"))
			now := time.Now().UTC()
			for i, id := range []domainshared.ID{older, newer} {
				at := now.Add(time.Duration(i) * gap)
				require.NoError(t, db.Create(&model.ChatMessage{ID: id.UUID(), ConversationID: conversationID.UUID(), SenderID: userID.UUID(), MessageType: "text", Content: "hi", IdempotencyKey: id.String(), CreatedAt: at, UpdatedAt: at}).Error)
			}
			earlier := now.Add(-time.Minute)
			advanced, err := repo.SaveReadPosition(ctx, domainchat.ReconstructReadPosition(conversationID, userID, &older, &earlier))
			require.NoError(t, err)
			require.True(t, advanced)
			advanced, err = repo.SaveReadPosition(ctx, domainchat.ReconstructReadPosition(conversationID, userID, &newer, &now))
			require.True(t, advanced)
			require.NoError(t, err)
			later := now.Add(time.Hour)
			for _, last := range []*domainshared.ID{&older, &newer, nil} {
				advanced, err = repo.SaveReadPosition(ctx, domainchat.ReconstructReadPosition(conversationID, userID, last, &later))
				require.False(t, advanced)
				require.NoError(t, err)
				position, err := repo.FindReadPosition(ctx, conversationID, userID)
				require.NoError(t, err)
				require.Equal(t, &newer, position.LastMessageID())
				require.True(t, position.ReadAt().Equal(now), "重复或过期上报不修改阅读时间")
			}
		})
	}
}
