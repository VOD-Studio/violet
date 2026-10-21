package music

import (
	"context"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

type Session struct {
	Profile music.Profile
	Cookie  string
}
type QRCode struct{ Key, URL string }
type QRResult struct {
	State   string
	Session *Session
}

type Provider interface {
	Configured() bool
	BaseURL() string
	Verify(context.Context) error
	LoginQR(context.Context) (QRCode, error)
	CheckQR(context.Context, string) (QRResult, error)
	Account(context.Context, string) (*Session, error)
	Refresh(context.Context, string) (string, error)
	Logout(context.Context, string) error
	UserPlaylists(context.Context, string, string, shared.PageQuery) (shared.PageResult[music.Playlist], error)
	SearchSongs(context.Context, string, shared.PageQuery) (shared.PageResult[music.Song], error)
	SearchPlaylists(context.Context, string, shared.PageQuery) (shared.PageResult[music.Playlist], error)
	Playlist(context.Context, string) (music.Playlist, error)
	Tracks(context.Context, string, string, shared.PageQuery) (shared.PageResult[music.Song], error)
	Song(context.Context, string) (music.Song, error)
	SongURL(context.Context, string, string) (music.SongURL, error)
	Lyric(context.Context, string) (music.Lyric, error)
}
type CredentialBox interface {
	Seal(string) (string, error)
	Open(string) (string, error)
}

// ProviderError 只携带安全消息；不保存响应体、请求头或凭据。
type ProviderError struct {
	Reason  string
	Message string
}

func (e *ProviderError) Error() string { return e.Message }
