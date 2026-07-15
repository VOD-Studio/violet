// Package music 提供音乐解析的基础设施适配器。
//
// MimoMusicProvider 实现 domain/music.MusicProvider 端口，内部通过
// pkg/mimomusic SDK 调用自托管的 mimo-music 服务解析网易云歌曲/歌单/歌词，
// 不再依赖 vkeys/meting 等第三方公开解析实例。
package music

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/VOD-Studio/mimo-music/pkg/mimomusic"

	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

// MimoMusicProvider 基于 mimo-music SDK 的音乐解析适配器。
//
// 通过 NewMimoMusicProvider 构造，连接自托管 mimo-music 服务。
// mimo-music 是受信内部服务，连接地址由配置注入，不走 SSRF 校验。
type MimoMusicProvider struct {
	client *mimomusic.Client
}

// NewMimoMusicProvider 创建 mimo-music 适配器。
//
// baseURL 是 mimo-music 服务地址（如 http://localhost:3721）。
func NewMimoMusicProvider(baseURL string) *MimoMusicProvider {
	client := mimomusic.NewClient(baseURL)
	return &MimoMusicProvider{client: client}
}

// ParseEmbedURL 解析音乐链接返回嵌入信息。
//
// 仅支持网易云单曲链接；QQ 音乐（tencent）链接返回 ErrUnsupportedMusicURL，
// 因 mimo-music 不支持 tencent 平台。
func (p *MimoMusicProvider) ParseEmbedURL(rawURL string) (domainmusic.EmbedInfo, error) {
	if songID := parseNeteaseSongID(rawURL); songID != "" {
		return domainmusic.EmbedInfo{
			Platform: "netease",
			SongID:   songID,
			EmbedURL: "https://music.163.com/outchain/player?type=2&id=" + songID + "&auto=0&height=66",
		}, nil
	}
	return domainmusic.EmbedInfo{}, domainmusic.ErrUnsupportedMusicURL
}

// Search 搜索歌曲。
func (p *MimoMusicProvider) Search(keyword string, limit int) ([]domainmusic.Song, error) {
	result, err := p.client.Search(context.Background(), keyword, mimomusic.WithLimit(limit))
	if err != nil {
		return nil, mapSDKErr(err, "音乐搜索失败")
	}
	return sdkSongsToDomain(result.Songs), nil
}

// FetchLyrics 获取歌词。
func (p *MimoMusicProvider) FetchLyrics(platform, songID string) (string, error) {
	lyric, err := p.client.GetLyric(context.Background(), songID)
	if err != nil {
		return "", mapSDKErr(err, "获取歌词失败")
	}
	return strings.TrimSpace(lyric.Lrc), nil
}

// FetchSongDetail 获取歌曲详情。
func (p *MimoMusicProvider) FetchSongDetail(platform, songID string) (*domainmusic.Song, error) {
	detail, err := p.client.GetSongDetail(context.Background(), songID)
	if err != nil {
		return nil, mapSDKErr(err, "获取歌曲详情失败")
	}
	return &domainmusic.Song{
		Name: detail.Name, Artist: detail.Artist, Cover: detail.Cover,
	}, nil
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）。
//
// 合并歌曲详情（取封面）和歌词两个调用。
func (p *MimoMusicProvider) FetchSongMeta(platform, songID string) (*domainmusic.SongMeta, error) {
	detail, err := p.client.GetSongDetail(context.Background(), songID)
	if err != nil {
		return nil, mapSDKErr(err, "获取歌曲元数据失败")
	}
	lyric, err := p.client.GetLyric(context.Background(), songID)
	if err != nil {
		return nil, mapSDKErr(err, "获取歌词失败")
	}
	return &domainmusic.SongMeta{
		Cover: detail.Cover, Lyrics: strings.TrimSpace(lyric.Lrc),
	}, nil
}

// FetchPlaylist 解析歌单链接返回歌曲列表。
//
// 从网易云歌单链接提取歌单 ID，调用 mimo-music 拉取完整歌曲列表。
// 仅支持网易云歌单；其他链接返回 ErrUnsupportedMusicURL。
func (p *MimoMusicProvider) FetchPlaylist(rawURL string) (*domainmusic.PlaylistMeta, error) {
	playlistID := parseNeteasePlaylistID(rawURL)
	if playlistID == "" {
		return nil, domainmusic.ErrUnsupportedMusicURL
	}
	playlist, err := p.client.GetPlaylist(context.Background(), playlistID)
	if err != nil {
		return nil, mapSDKErr(err, "解析歌单失败")
	}
	return &domainmusic.PlaylistMeta{
		Title:      playlist.Title,
		Cover:      playlist.Cover,
		Creator:    playlist.Creator,
		Platform:   "netease",
		PlaylistID: playlist.ID,
		Songs:      sdkSongsToDomain(playlist.Songs),
	}, nil
}

// 编译期断言
var _ domainmusic.MusicProvider = (*MimoMusicProvider)(nil)

// mapSDKErr 把 mimo-music SDK 哨兵错误映射到 domain shared 错误。
//
// 资源不存在 → NotFound；参数/不支持 → BadRequest；其余 → Internal。
// 所有分支都用 WithErr 包装底层错误，保留 errors.Is 穿透能力。
func mapSDKErr(err error, msg string) error {
	switch {
	case errors.Is(err, mimomusic.ErrNotFound):
		return shared.NotFound("歌曲").WithErr(err)
	case errors.Is(err, mimomusic.ErrInvalidRequest), errors.Is(err, mimomusic.ErrUnsupportedPlatform):
		return shared.BadRequest(msg).WithErr(err)
	default:
		return shared.Internal(msg, err)
	}
}

// sdkSongsToDomain 把 SDK Song 列表转成 domain Song 列表。
func sdkSongsToDomain(songs []mimomusic.Song) []domainmusic.Song {
	result := make([]domainmusic.Song, 0, len(songs))
	for _, s := range songs {
		result = append(result, domainmusic.Song{
			Name: s.Name, Artist: s.Artist, Cover: s.Cover,
		})
	}
	return result
}

// ============================================================
// URL 解析（网易云歌曲/歌单 ID 提取）
// ============================================================

// parseNeteaseSongID 从网易云单曲链接提取歌曲 ID。
func parseNeteaseSongID(rawURL string) string {
	re := regexp.MustCompile(`music\.163\.com/(#/?song\?id=|song/)([0-9]+)`)
	if m := re.FindStringSubmatch(rawURL); len(m) >= 3 {
		return m[2]
	}
	re2 := regexp.MustCompile(`music\.163\.com.*[?&]id=([0-9]+)`)
	if m := re2.FindStringSubmatch(rawURL); len(m) >= 2 {
		return m[1]
	}
	return ""
}

// parseNeteasePlaylistID 从网易云歌单链接提取歌单 ID。
func parseNeteasePlaylistID(rawURL string) string {
	re := regexp.MustCompile(`music\.163\.com/(#/?playlist\?id=|playlist/)([0-9]+)`)
	if m := re.FindStringSubmatch(rawURL); len(m) >= 3 {
		return m[2]
	}
	re2 := regexp.MustCompile(`music\.163\.com.*[?&]id=([0-9]+)`)
	if m := re2.FindStringSubmatch(rawURL); len(m) >= 2 {
		return m[1]
	}
	return ""
}
