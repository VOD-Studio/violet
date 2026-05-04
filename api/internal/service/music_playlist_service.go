// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"errors"
	"regexp"
	"strings"
)

// 歌单相关错误定义
var (
	ErrPlaylistNotFound = errors.New("歌单不存在")
	ErrPlaylistAPI      = errors.New("获取歌单信息失败")
)

// PlaylistInfo 歌单信息
type PlaylistInfo struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Cover    string      `json:"cover"`
	Creator  string      `json:"creator"`
	Count    int         `json:"count"`
	Platform string      `json:"platform"`
	Songs    []*SongInfo `json:"songs"`
}

// SongInfo 歌曲信息
type SongInfo struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	Album    string `json:"album"`
	Cover    string `json:"cover"`
	Duration int    `json:"duration"` // 秒
	URL      string `json:"url"`      // 播放链接
	Platform string `json:"platform"` // 来源平台
	Lrc      string `json:"lrc,omitempty"`
}

// ParsePlaylistURL 解析歌单链接
// 支持从分享文本中提取链接
func (s *MusicService) ParsePlaylistURL(link string) (*PlaylistInfo, error) {
	// 从分享文本中提取 URL（如果用户复制了完整的分享文本）
	// 例如："分享歌单 《常听》https://c6.y.qq.com/base/fcgi-bin/u?__=xxx @QQ音乐"
	re := regexp.MustCompile(`https?://[^\s]+`)
	matches := re.FindStringSubmatch(link)
	if len(matches) >= 1 {
		link = matches[0]
	}

	// 网易云歌单
	if strings.Contains(link, "music.163.com") {
		id := parseNeteasePlaylistID(link)
		if id != "" {
			return s.FetchNeteasePlaylist(id)
		}
	}

	// QQ音乐歌单（包括短链接）
	if strings.Contains(link, "y.qq.com") || strings.Contains(link, "c6.y.qq.com") {
		// 如果是短链接，先获取跳转后的 URL 和基本信息
		if strings.Contains(link, "c6.y.qq.com") || strings.Contains(link, "base/fcgi-bin/u") {
			return s.FetchQQPlaylistFromShortLink(link)
		}
		id := parseQQPlaylistID(link)
		if id != "" {
			// 对于普通 QQ 音乐链接，返回基本信息，前端通过 Meting 获取歌曲
			return &PlaylistInfo{
				ID:       id,
				Title:    "QQ音乐歌单",
				Platform: "tencent",
				Count:    0,
				Songs:    []*SongInfo{},
			}, nil
		}
	}

	return nil, ErrUnsupportedMusicURL
}

// FetchSongDetail 获取歌曲详情（用于获取播放链接）
func (s *MusicService) FetchSongDetail(platform, songID string) (*SongInfo, error) {
	switch platform {
	case "netease":
		return s.FetchNeteaseSongDetail(songID)
	case "tencent":
		return s.FetchQQSongDetail(songID)
	default:
		return nil, ErrUnsupportedMusicURL
	}
}

// extractJSONP 从 JSONP 响应中提取 JSON
func extractJSONP(body []byte) string {
	str := string(body)
	// JSONP 格式: callback({...})
	start := strings.Index(str, "(")
	end := strings.LastIndex(str, ")")
	if start != -1 && end != -1 && end > start {
		return str[start+1 : end]
	}
	return str
}

// parseNeteasePlaylistID 从网易云链接提取歌单 ID
func parseNeteasePlaylistID(link string) string {
	re := regexp.MustCompile(`music\.163\.com.*[?&]id=(\d+)`)
	matches := re.FindStringSubmatch(link)
	if len(matches) >= 2 {
		return matches[1]
	}
	re2 := regexp.MustCompile(`/playlist/(\d+)`)
	matches2 := re2.FindStringSubmatch(link)
	if len(matches2) >= 2 {
		return matches2[1]
	}
	return ""
}

// parseQQPlaylistID 从QQ音乐链接提取歌单 ID
func parseQQPlaylistID(link string) string {
	// 新版链接格式：y.qq.com/n/ryqq/playlist/xxx 或 y.qq.com/n/ryqq_v2/playlist/xxx
	// 注意可能有双斜杠
	re := regexp.MustCompile(`y\.qq\.com//?n/ryqq(?:_v2)?/playlist/(\d+)`)
	matches := re.FindStringSubmatch(link)
	if len(matches) >= 2 {
		return matches[1]
	}

	// 旧版链接格式：/playlist/xxx
	re2 := regexp.MustCompile(`/playlist/(\w+)`)
	matches2 := re2.FindStringSubmatch(link)
	if len(matches2) >= 2 {
		return matches2[1]
	}

	// URL 参数格式：?id=xxx 或 &id=xxx
	re3 := regexp.MustCompile(`[?&]id=(\w+)`)
	matches3 := re3.FindStringSubmatch(link)
	if len(matches3) >= 2 {
		return matches3[1]
	}

	return ""
}
