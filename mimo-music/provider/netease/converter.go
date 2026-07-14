// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"fmt"

	"github.com/VOD-Studio/mimo-music/model"
	"github.com/VOD-Studio/mimo-music/provider"
)

// neteaseSongDetail 是网易云歌曲详情接口的原始 JSON 结构。
type neteaseSongDetail struct {
	// Songs 是歌曲数组。
	Songs []struct {
		// ID 是歌曲 ID。
		ID int64 `json:"id"`
		// Name 是歌曲名。
		Name string `json:"name"`
		// Ar 是歌手数组。
		Ar []struct {
			// Name 是歌手名。
			Name string `json:"name"`
		} `json:"ar"`
		// Al 是专辑信息。
		Al struct {
			// Name 是专辑名。
			Name string `json:"name"`
			// PicUrl 是专辑封面 URL。
			PicUrl string `json:"picUrl"`
		} `json:"al"`
		// Dt 是歌曲时长（毫秒）。
		Dt int64 `json:"dt"`
	} `json:"songs"`
}

// toSongResult 把网易云原始歌曲结构转成统一 SongResult。
func toSongResult(s neteaseSongDetailSongs) provider.SongResult {
	return provider.SongResult{
		ID:       fmt.Sprintf("%d", s.ID),
		Name:     s.Name,
		Artist:   joinArtists(s.Ar),
		Album:    s.Al.Name,
		Cover:    s.Al.PicUrl,
		Duration: s.Dt,
	}
}

// neteaseSongDetailSongs 用于 converter 引用。
type neteaseSongDetailSongs = struct {
	ID   int64 `json:"id"`
	Name string `json:"name"`
	Ar   []struct {
		Name string `json:"name"`
	} `json:"ar"`
	Al struct {
		Name    string `json:"name"`
		PicUrl  string `json:"picUrl"`
	} `json:"al"`
	Dt int64 `json:"dt"`
}

// joinArtists 把歌手数组合并为 "歌手1/歌手2" 格式。
func joinArtists(artists []struct {
	Name string `json:"name"`
}) string {
	if len(artists) == 0 {
		return ""
	}
	names := make([]string, 0, len(artists))
	for _, a := range artists {
		if a.Name != "" {
			names = append(names, a.Name)
		}
	}
	if len(names) == 0 {
		return ""
	}
	result := names[0]
	for _, n := range names[1:] {
		result += "/" + n
	}
	return result
}

// neteasePlaylistDetail 是网易云歌单详情的原始 JSON 结构。
type neteasePlaylistDetail struct {
	// Playlist 是歌单信息。
	Playlist struct {
		// ID 是歌单 ID。
		ID int64 `json:"id"`
		// Name 是歌单名。
		Name string `json:"name"`
		// CoverImgUrl 是封面 URL。
		CoverImgUrl string `json:"coverImgUrl"`
		// Creator 是创建者。
		Creator struct {
			// Nickname 是创建者昵称。
			Nickname string `json:"nickname"`
		} `json:"creator"`
		// TrackCount 是歌曲总数。
		TrackCount int `json:"trackCount"`
		// Tracks 是歌曲列表（可能为空，需单独拉取）。
		Tracks []neteaseSongDetailSongs `json:"tracks"`
		// TrackIds 是歌曲 ID 列表（用于分页拉取）。
		TrackIds []struct {
			ID int64 `json:"id"`
		} `json:"trackIds"`
	} `json:"playlist"`
}

// neteaseLyric 是网易云歌词响应结构。
type neteaseLyric struct {
	// Lrc 是原始 LRC 歌词。
	Lrc struct {
		Version int    `json:"version"`
		Lyric   string `json:"lyric"`
	} `json:"lrc"`
	// Tlyric 是翻译歌词。
	Tlyric struct {
		Version int    `json:"version"`
		Lyric   string `json:"lyric"`
	} `json:"tlyric"`
	// Romalrc 是音译歌词。
	Romalrc struct {
		Version int    `json:"version"`
		Lyric   string `json:"lyric"`
	} `json:"romalrc"`
}

// neteaseSongURL 是网易云播放 URL 响应结构。
type neteaseSongURL struct {
	// Data 是歌曲 URL 数据数组。
	Data []struct {
		// ID 是歌曲 ID。
		ID int64 `json:"id"`
		// URL 是播放直链（VIP 歌曲可能为空）。
		URL string `json:"url"`
		// Br 是比特率。
		Br int64 `json:"br"`
		// Size 是文件大小。
		Size int64 `json:"size"`
		// Type 是文件类型（mp3 / flac 等）。
		Type string `json:"type"`
	} `json:"data"`
}

// toModelSong 把 provider.SongResult 转 model.Song。
func toModelSong(s provider.SongResult) model.Song {
	return model.Song{
		ID:       s.ID,
		Name:     s.Name,
		Artist:   s.Artist,
		Album:    s.Album,
		Cover:    s.Cover,
		Duration: s.Duration,
	}
}

// toModelLyrics 把 provider.LyricResult 转 model.Lyrics。
func toModelLyrics(l provider.LyricResult) model.Lyrics {
	return model.Lyrics{
		Lrc:        l.Lrc,
		Translated: l.Translated,
		Romanized:  l.Romanized,
	}
}
