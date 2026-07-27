// Package music 提供音乐解析的基础设施适配器。
//
// KiteProvider 实现 domain/music.MusicProvider 端口。当前为 stub 实现：
// kite 服务依赖已从 api 模块移除，需要联网的解析能力（搜索/歌词/详情/歌单导入）
// 一律返回「服务未启用」错误；仅保留不依赖服务的纯逻辑（单曲嵌入链接生成、网易云
// URL 解析）。重新接入自托管 kite 服务时，把本文件换回真实 SDK 适配器即可。
package music

import (
	"regexp"

	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

// KiteProvider 音乐解析适配器的 stub 实现。
//
// stub 模式下不持有任何客户端，构造函数签名保留是为了不破坏装配层调用方。
type KiteProvider struct {
}

// NewKiteProvider 创建音乐解析适配器。
//
// baseURL 在 stub 模式下被忽略；保留参数仅为维持调用方签名不变，
// 重新接入 kite 后在此构造真实客户端。
func NewKiteProvider(baseURL string) *KiteProvider {
	return &KiteProvider{}
}

// ParseEmbedURL 解析音乐链接返回嵌入信息。
//
// 仅支持网易云单曲链接；QQ 音乐（tencent）链接返回 ErrUnsupportedMusicURL。
// 纯逻辑，不依赖 kite 服务。
func (p *KiteProvider) ParseEmbedURL(rawURL string) (domainmusic.EmbedInfo, error) {
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
//
// stub：音乐解析服务未启用。
func (p *KiteProvider) Search(keyword string, limit int) ([]domainmusic.Song, error) {
	return nil, errMusicServiceDisabled
}

// FetchLyrics 获取歌词。
//
// stub：音乐解析服务未启用。
func (p *KiteProvider) FetchLyrics(platform, songID string) (string, error) {
	return "", errMusicServiceDisabled
}

// FetchSongDetail 获取歌曲详情。
//
// stub：音乐解析服务未启用。
func (p *KiteProvider) FetchSongDetail(platform, songID string) (*domainmusic.Song, error) {
	return nil, errMusicServiceDisabled
}

// FetchSongMeta 获取歌曲元数据（封面+歌词）。
//
// stub：音乐解析服务未启用。
func (p *KiteProvider) FetchSongMeta(platform, songID string) (*domainmusic.SongMeta, error) {
	return nil, errMusicServiceDisabled
}

// FetchPlaylist 解析歌单链接返回歌曲列表。
//
// 仍校验 URL 是否为合法网易云歌单链接（非法格式返回 ErrUnsupportedMusicURL），
// 合法链接在 stub 模式下返回「服务未启用」。
func (p *KiteProvider) FetchPlaylist(rawURL string) (*domainmusic.PlaylistMeta, error) {
	if parseNeteasePlaylistID(rawURL) == "" {
		return nil, domainmusic.ErrUnsupportedMusicURL
	}
	return nil, errMusicServiceDisabled
}

// 编译期断言
var _ domainmusic.MusicProvider = (*KiteProvider)(nil)

// errMusicServiceDisabled stub 模式下所有联网解析方法的统一错误。
//
// 用 Internal 错误码：服务能力缺失属于系统侧问题，而非请求参数错误。
var errMusicServiceDisabled = shared.Internal("音乐解析服务暂未启用", nil)

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
