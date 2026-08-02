package music

import (
	"context"

	"blog-api/internal/domain/shared"
)

// PlaylistRepository 歌单仓储接口
type PlaylistRepository interface {
	FindByID(ctx context.Context, id shared.ID) (*Playlist, error)
	FindActive(ctx context.Context) ([]*Playlist, error)
	FindAll(ctx context.Context) ([]*Playlist, error)
	Save(ctx context.Context, p *Playlist) error
	Delete(ctx context.Context, id shared.ID) error
}

// MusicProvider 音乐解析端口（infrastructure 层实现，封装网易云 API）
//
// 提供音乐链接解析、歌曲搜索、歌词获取、详情查询能力。
// 当前实现走自托管 kite 服务，由 infrastructure/music 包提供。
type MusicProvider interface {
	// ParseEmbedURL 解析音乐链接返回嵌入信息（平台/歌曲ID/嵌入URL）
	ParseEmbedURL(url string) (EmbedInfo, error)
	// Search 搜索歌曲
	Search(keyword string, limit int) ([]Song, error)
	// FetchLyrics 获取歌词
	FetchLyrics(platform, songID string) (string, error)
	// FetchSongDetail 获取歌曲详情
	FetchSongDetail(platform, songID string) (*Song, error)
	// FetchSongMeta 获取歌曲元数据（封面+歌词）
	FetchSongMeta(platform, songID string) (*SongMeta, error)
	// FetchPlaylist 解析歌单链接返回歌曲列表（用于歌单导入/刷新）
	FetchPlaylist(url string) (*PlaylistMeta, error)
}

// EmbedInfo 音乐嵌入信息
type EmbedInfo struct {
	// Platform 来源平台标识（如 netease）
	Platform string
	// SongID 平台侧歌曲 id（用于拉歌词/详情/元数据）
	SongID string
	// EmbedURL 可直接嵌入播放器的 URL
	EmbedURL string
}

// SongMeta 歌曲元数据（封面+歌词）
type SongMeta struct {
	// Cover 封面图 URL
	Cover string
	// Lyrics 歌词文本（纯文本或 LRC）
	Lyrics string
}

// PlaylistMeta 歌单元数据（导入/刷新时解析第三方歌单）
type PlaylistMeta struct {
	// Title 歌单标题
	Title string
	// Cover 歌单封面图 URL
	Cover string
	// Creator 歌单创建者名
	Creator string
	// Platform 来源平台标识（如 netease）
	Platform string
	// PlaylistID 平台侧歌单 id
	PlaylistID string
	// Songs 歌单内歌曲列表（导入/刷新时落库）
	Songs []Song
}

var ErrNotFound = shared.NotFound("歌单")
var ErrUnsupportedMusicURL = shared.BadRequest("不支持的音乐链接格式")
