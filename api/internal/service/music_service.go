package service

import (
	"errors"
	"regexp"
	"strings"
)

// 音乐解析相关错误定义
var (
	ErrUnsupportedMusicURL = errors.New("不支持的音乐链接格式")
)

// MusicEmbedInfo 音乐嵌入信息
type MusicEmbedInfo struct {
	Platform string `json:"platform"`
	SongID   string `json:"song_id"`
	EmbedURL string `json:"embed_url"`
	Title    string `json:"title"`
}

// MusicService 音乐嵌入业务服务
type MusicService struct{}

// NewMusicService 创建音乐嵌入服务实例
func NewMusicService() *MusicService {
	return &MusicService{}
}

// ParseMusicURL 解析音乐链接，返回嵌入信息
// 支持网易云音乐和 QQ 音乐链接
func (s *MusicService) ParseMusicURL(url string) (*MusicEmbedInfo, error) {
	if songID := parseNeteaseSongID(url); songID != "" {
		return &MusicEmbedInfo{
			Platform: "netease",
			SongID:   songID,
			EmbedURL: "https://music.163.com/outchain/player?type=2&id=" + songID + "&auto=0&height=66",
		}, nil
	}

	if songID := parseQQMusicSongID(url); songID != "" {
		return &MusicEmbedInfo{
			Platform: "tencent",
			SongID:   songID,
			EmbedURL: "https://i.y.qq.com/nryyun/song/" + songID,
		}, nil
	}

	return nil, ErrUnsupportedMusicURL
}

// parseNeteaseSongID 从网易云音乐链接中提取歌曲 ID
// 支持格式：
// https://music.163.com/#/song?id=xxx
// https://music.163.com/song?id=xxx
// https://music.163.com/song/xxx
func parseNeteaseSongID(url string) string {
	re := regexp.MustCompile(`music\.163\.com/(#/?song\?id=|song/)([0-9]+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) >= 3 {
		return matches[2]
	}

	re2 := regexp.MustCompile(`music\.163\.com.*[?&]id=([0-9]+)`)
	matches2 := re2.FindStringSubmatch(url)
	if len(matches2) >= 2 {
		return matches2[1]
	}

	return ""
}

// parseQQMusicSongID 从 QQ 音乐链接中提取歌曲 ID
// 支持格式：
// https://y.qq.com/n/ryqq/songDetail/xxx
// https://y.qq.com/n/ryqq/song/xxx
// https://i.y.qq.com/v8/playsong.html?songid=xxx
func parseQQMusicSongID(url string) string {
	if !strings.Contains(url, "y.qq.com") {
		return ""
	}

	re := regexp.MustCompile(`/song(?:Detail)?/([a-zA-Z0-9]+)`)
	matches := re.FindStringSubmatch(url)
	if len(matches) >= 2 {
		return matches[1]
	}

	re2 := regexp.MustCompile(`[?&]song(?:id|mid)=([a-zA-Z0-9]+)`)
	matches2 := re2.FindStringSubmatch(url)
	if len(matches2) >= 2 {
		return matches2[1]
	}

	return ""
}
