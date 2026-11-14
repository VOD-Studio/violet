package chat

import (
	"context"
	"strings"
	"time"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

// MusicShareDTO 只读取发送时的快照，不依赖音乐服务的当前状态。
type MusicShareDTO struct {
	TrackID string   `json:"track_id"`
	Title   string   `json:"title"`
	Artists []string `json:"artists"`
	// DurationMS 单位毫秒。
	DurationMS int64  `json:"duration_ms"`
	CoverURL   string `json:"cover_url"`
}

func (s *Service) WithMusicResolver(resolver MusicResolver) *Service {
	s.music = resolver
	return s
}

func (s *Service) newMusicShareMessage(ctx context.Context, in SendMessageInput, now time.Time, replyToID *domainshared.ID) (*domainchat.Message, error) {
	trackID := strings.TrimSpace(in.MusicTrackID)
	if trackID == "" {
		return nil, domainshared.BadRequest("歌曲 ID 不能为空")
	}
	if s.music == nil {
		return nil, domainshared.BadRequest("尚未配置音乐服务")
	}
	song, err := s.music.Song(ctx, trackID)
	if err != nil {
		return nil, domainshared.BadRequest("无法分享歌曲，请确认歌曲存在且音乐服务可用").WithErr(err)
	}
	artists := make([]string, len(song.Artists))
	for i, artist := range song.Artists {
		artists[i] = artist.Name
	}
	return domainchat.NewMusicShareMessage(in.ConversationID, in.UserID, domainchat.MusicShare{
		TrackID: song.ID, Title: song.Name, Artists: artists, DurationMS: song.DurationMS, CoverURL: song.Album.CoverURL,
	}, in.Content, in.IdempotencyKey, now, replyToID)
}
