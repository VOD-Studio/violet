package chat_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
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

	text, err := chat.NewTextMessage(conversationID, senderID, " hello ", "retry-1", now, nil)
	require.NoError(t, err)
	require.Equal(t, "hello", text.Content())
	require.Equal(t, chat.MessageText, text.Type())

	_, err = chat.NewTextMessage(conversationID, senderID, "", "retry-2", now, nil)
	require.Error(t, err)
	_, err = chat.NewTextMessage(conversationID, senderID, "hello", "", now, nil)
	require.Error(t, err)

	image, err := chat.NewImageMessage(conversationID, senderID, []shared.ID{shared.NewID()}, "", "retry-3", now, nil)
	require.NoError(t, err)
	require.Equal(t, chat.MessageImage, image.Type())
	require.Len(t, image.MediaIDs(), 1)
	require.Equal(t, "", image.Content())
}

func TestNewImageMessageSupportsMultipleMedia(t *testing.T) {
	now := time.Now()
	conversationID := shared.NewID()
	senderID := shared.NewID()
	mediaA := shared.NewID()
	mediaB := shared.NewID()

	message, err := chat.NewImageMessage(conversationID, senderID, []shared.ID{mediaA, mediaB}, "", "retry-multi-1", now, nil)
	require.NoError(t, err)
	require.Equal(t, []shared.ID{mediaA, mediaB}, message.MediaIDs())

	// 重复媒体按首次出现去重，关联表主键 (message_id, media_id) 不允许重复行。
	deduped, err := chat.NewImageMessage(conversationID, senderID, []shared.ID{mediaA, mediaB, mediaA}, "", "retry-multi-2", now, nil)
	require.NoError(t, err)
	require.Equal(t, []shared.ID{mediaA, mediaB}, deduped.MediaIDs())

	_, err = chat.NewImageMessage(conversationID, senderID, nil, "", "retry-multi-3", now, nil)
	require.Error(t, err)
}

func TestNewImageMessageAllowsOptionalCaption(t *testing.T) {
	now := time.Now()
	conversationID := shared.NewID()
	senderID := shared.NewID()
	mediaID := shared.NewID()

	captioned, err := chat.NewImageMessage(conversationID, senderID, []shared.ID{mediaID}, "  快来看  ", "retry-caption-1", now, nil)
	require.NoError(t, err)
	require.Equal(t, "快来看", captioned.Content())
	require.Equal(t, []shared.ID{mediaID}, captioned.MediaIDs())

	withoutCaption, err := chat.NewImageMessage(conversationID, senderID, []shared.ID{mediaID}, "   ", "retry-caption-2", now, nil)
	require.NoError(t, err)
	require.Equal(t, "", withoutCaption.Content())

	overLong := make([]rune, chat.MaxMessageContentLength+1)
	for i := range overLong {
		overLong[i] = 'a'
	}
	_, err = chat.NewImageMessage(conversationID, senderID, []shared.ID{mediaID}, string(overLong), "retry-caption-3", now, nil)
	require.Error(t, err)

	_, err = chat.NewImageMessage(conversationID, senderID, []shared.ID{shared.ID{}}, "caption", "retry-caption-4", now, nil)
	require.Error(t, err)

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
	require.Empty(t, message.MediaIDs())
}

func TestMessageDeleteIsOneWay(t *testing.T) {
	message, err := chat.NewTextMessage(shared.NewID(), shared.NewID(), "moderate me", "retry-1", time.Now(), nil)
	require.NoError(t, err)
	adminID := shared.NewID()

	require.NoError(t, message.Delete(adminID, time.Now()))
	require.NotNil(t, message.DeletedAt())
	require.Equal(t, adminID, *message.DeletedBy())
	require.Error(t, message.Delete(adminID, time.Now()))
}

func TestMessageFactoryPreservesReplyTarget(t *testing.T) {
	conversationID := shared.NewID()
	senderID := shared.NewID()
	replyToID := shared.NewID()

	message, err := chat.NewTextMessage(conversationID, senderID, "reply", "retry-reply", time.Now(), &replyToID)
	require.NoError(t, err)
	require.NotNil(t, message.ReplyToID())
	require.Equal(t, replyToID, *message.ReplyToID())
}

func TestMessageFactoryRejectsZeroReplyTarget(t *testing.T) {
	zeroID := shared.ID{}

	_, err := chat.NewTextMessage(shared.NewID(), shared.NewID(), "reply", "retry-reply-zero", time.Now(), &zeroID)
	require.Error(t, err)
}

func TestNewTweetShareMessageValidatesPayload(t *testing.T) {
	now := time.Now()
	conversationID := shared.NewID()
	senderID := shared.NewID()
	tweetID := shared.NewID()

	share, err := chat.NewTweetShareMessage(conversationID, senderID, tweetID, "  快来看  ", "retry-share-1", now, nil)
	require.NoError(t, err)
	require.Equal(t, chat.MessageTweetShare, share.Type())
	require.Equal(t, "快来看", share.Content())
	require.NotNil(t, share.SharedTweetID())
	require.Equal(t, tweetID, *share.SharedTweetID())
	require.Empty(t, share.MediaIDs())

	withoutCaption, err := chat.NewTweetShareMessage(conversationID, senderID, tweetID, "   ", "retry-share-2", now, nil)
	require.NoError(t, err)
	require.Equal(t, "", withoutCaption.Content())

	_, err = chat.NewTweetShareMessage(conversationID, senderID, shared.ID{}, "", "retry-share-3", now, nil)
	require.Error(t, err)

	overLong := make([]rune, chat.MaxMessageContentLength+1)
	for i := range overLong {
		overLong[i] = 'a'
	}
	_, err = chat.NewTweetShareMessage(conversationID, senderID, tweetID, string(overLong), "retry-share-4", now, nil)
	require.Error(t, err)

	_, err = chat.NewTweetShareMessage(conversationID, senderID, tweetID, "caption", "", now, nil)
	require.Error(t, err)
}

func TestMessageEditRevisesContentAndStampsEditedAt(t *testing.T) {
	now := time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	conversationID := shared.NewID()
	senderID := shared.NewID()

	text, err := chat.NewTextMessage(conversationID, senderID, "原始内容", "edit-1", now, nil)
	require.NoError(t, err)
	require.Nil(t, text.EditedAt())

	later := now.Add(time.Hour)
	require.NoError(t, text.Edit(" 修订内容 ", nil, later))
	require.Equal(t, "修订内容", text.Content())
	require.NotNil(t, text.EditedAt())
	require.Equal(t, later, *text.EditedAt())
	require.Equal(t, later, text.UpdatedAt)

	require.Error(t, text.Edit("", nil, later.Add(time.Minute)))
	require.Error(t, text.Edit("x", []shared.ID{shared.NewID()}, later.Add(time.Minute)))
}

func TestMessageEditImageKeepsAtLeastOneMedia(t *testing.T) {
	now := time.Now()
	mediaA := shared.NewID()
	mediaB := shared.NewID()
	mediaC := shared.NewID()

	image, err := chat.NewImageMessage(shared.NewID(), shared.NewID(), []shared.ID{mediaA, mediaB}, "旧说明", "edit-img-1", now, nil)
	require.NoError(t, err)

	// 移除 mediaB、追加 mediaC，重复 ID 按首次出现去重。
	require.NoError(t, image.Edit("新说明", []shared.ID{mediaA, mediaC, mediaC}, now.Add(time.Hour)))
	require.Equal(t, "新说明", image.Content())
	require.Equal(t, []shared.ID{mediaA, mediaC}, image.MediaIDs())
	require.NotNil(t, image.EditedAt())

	require.Error(t, image.Edit("新说明", nil, now.Add(2*time.Hour)))
}

func TestMessageEditTweetShareCaptionOnly(t *testing.T) {
	now := time.Now()
	share, err := chat.NewTweetShareMessage(shared.NewID(), shared.NewID(), shared.NewID(), "旧配文", "edit-ts-1", now, nil)
	require.NoError(t, err)

	require.NoError(t, share.Edit("新配文", nil, now.Add(time.Hour)))
	require.Equal(t, "新配文", share.Content())
	require.NotNil(t, share.EditedAt())

	// 配文可清空，与发送时 caption 可选一致。
	require.NoError(t, share.Edit("", nil, now.Add(2*time.Hour)))
	require.Equal(t, "", share.Content())

	require.Error(t, share.Edit("x", []shared.ID{shared.NewID()}, now.Add(3*time.Hour)))
}

func TestMessageEditRejectsSystemAndDeleted(t *testing.T) {
	now := time.Now()
	system, err := chat.NewSystemMessage(shared.NewID(), shared.NewID(), "成员加入", "edit-sys-1", now)
	require.NoError(t, err)
	require.Error(t, system.Edit("篡改系统消息", nil, now.Add(time.Hour)))

	text, err := chat.NewTextMessage(shared.NewID(), shared.NewID(), "内容", "edit-del-1", now, nil)
	require.NoError(t, err)
	require.NoError(t, text.Delete(shared.NewID(), now.Add(time.Minute)))
	require.Error(t, text.Edit("编辑已删除消息", nil, now.Add(time.Hour)))
}

func TestMessageEditNoopSkipsEditedMarker(t *testing.T) {
	now := time.Now()
	mediaA := shared.NewID()
	image, err := chat.NewImageMessage(shared.NewID(), shared.NewID(), []shared.ID{mediaA}, "说明", "edit-noop-1", now, nil)
	require.NoError(t, err)

	// 内容与媒体均未变化时不产生编辑标记。
	require.NoError(t, image.Edit("说明", []shared.ID{mediaA}, now.Add(time.Hour)))
	require.Nil(t, image.EditedAt())

	text, err := chat.NewTextMessage(shared.NewID(), shared.NewID(), "内容", "edit-noop-2", now, nil)
	require.NoError(t, err)
	require.NoError(t, text.Edit("内容", nil, now.Add(time.Hour)))
	require.Nil(t, text.EditedAt())
}

func TestMemberReadStateCovers(t *testing.T) {
	conversationID := shared.NewID()
	senderID := shared.NewID()
	base := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	u1 := shared.IDFromUUID(uuid.UUID{0x01})
	u2 := shared.IDFromUUID(uuid.UUID{0x02})
	u3 := shared.IDFromUUID(uuid.UUID{0x03})
	u4 := shared.IDFromUUID(uuid.UUID{0x04})
	messageAt := func(id shared.ID, at time.Time) *chat.Message {
		return chat.ReconstructMessage(id, conversationID, senderID, chat.MessageText, "内容", nil, nil, nil, "k-"+id.String(), nil, nil, nil, at, at)
	}

	older := messageAt(u1, base.Add(-time.Hour))
	sameLow := messageAt(u1, base)
	sameHigh := messageAt(u3, base)
	newer := messageAt(u4, base.Add(time.Hour))

	watermark := base
	state := chat.MemberReadState{UserID: shared.NewID(), LastMessageID: &u2, LastReadAt: &watermark, ReadAt: &watermark}
	require.True(t, state.Covers(older))
	require.True(t, state.Covers(sameLow))
	require.False(t, state.Covers(sameHigh))
	require.False(t, state.Covers(newer))

	empty := chat.MemberReadState{UserID: shared.NewID()}
	require.False(t, empty.Covers(older))
}
