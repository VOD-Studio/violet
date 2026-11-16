package chat

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainmusic "blog-api/internal/domain/music"
	domainshared "blog-api/internal/domain/shared"
)

type shareMusicResolver struct {
	song domainmusic.Song
	err  error
}

func (r *shareMusicResolver) Song(context.Context, string) (domainmusic.Song, error) {
	return r.song, r.err
}

func TestSendMusicShareKeepsCaptionAndSongSnapshot(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)
	resolver := &shareMusicResolver{song: domainmusic.Song{
		ID: "347230", Name: "雨の日",
		Artists:    []domainmusic.Artist{{ID: "1", Name: "歌手 A"}, {ID: "2", Name: "歌手 B"}},
		DurationMS: 297000, Album: domainmusic.Album{CoverURL: "https://example.com/cover.jpg"},
	}}
	svc.WithMusicResolver(resolver)

	got, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageMusicShare,
		Content: "下雨天的话，听这首吧。", MusicTrackID: "347230", IdempotencyKey: "song-share",
	})
	require.NoError(t, err)
	require.NotNil(t, repo.saved)
	require.NotNil(t, got.MusicShare)
	assert.Equal(t, "下雨天的话，听这首吧。", got.Content)
	assert.Equal(t, "music_share", got.Type)
	assert.Equal(t, &MusicShareDTO{
		TrackID: "347230", Title: "雨の日", Artists: []string{"歌手 A", "歌手 B"},
		DurationMS: 297000, CoverURL: "https://example.com/cover.jpg",
	}, got.MusicShare)

	resolver.song.Name = "已更名"
	resolver.song.Artists[0].Name = "已改名"
	svc.WithMusicResolver(nil)
	listed, err := svc.ListMessages(context.Background(), userID, conversationID, "", 20)
	require.NoError(t, err)
	require.Len(t, listed.Items, 1)
	assert.Equal(t, got.MusicShare, listed.Items[0].MusicShare)
	assert.Equal(t, "下雨天的话，听这首吧。", listed.Items[0].Content)
}

func TestSendMusicShareRejectsResolutionFailureWithoutSaving(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)
	resolutionError := domainshared.Internal("音乐服务未找到歌曲", nil)
	svc.WithMusicResolver(&shareMusicResolver{err: resolutionError})

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageMusicShare,
		MusicTrackID: "404", IdempotencyKey: "missing-song",
	})
	require.ErrorIs(t, err, resolutionError)
	var domainError *domainshared.DomainError
	require.ErrorAs(t, err, &domainError)
	assert.Equal(t, domainshared.CodeBadRequest, domainError.Code)
	assert.Contains(t, domainError.Message, "歌曲")
	assert.Nil(t, repo.saved)
}

func TestSendMusicShareRejectsEmptyTrackID(t *testing.T) {
	userID, conversationID := domainshared.NewID(), domainshared.NewID()
	svc, repo := newShareService(t, nil, userID, domainshared.NewID(), conversationID)
	svc.WithMusicResolver(&shareMusicResolver{song: domainmusic.Song{ID: "347230", Name: "雨の日"}})

	_, err := svc.SendMessage(context.Background(), SendMessageInput{
		UserID: userID, ConversationID: conversationID, Type: domainchat.MessageMusicShare,
		MusicTrackID: "  ", IdempotencyKey: "empty-song",
	})
	var domainError *domainshared.DomainError
	require.ErrorAs(t, err, &domainError)
	assert.Equal(t, domainshared.CodeBadRequest, domainError.Code)
	assert.Nil(t, repo.saved)
}
