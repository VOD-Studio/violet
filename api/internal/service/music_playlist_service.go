package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// 歌单相关错误定义
var (
	ErrPlaylistNotFound = errors.New("歌单不存在")
	ErrPlaylistAPI      = errors.New("获取歌单信息失败")
)

// PlaylistInfo 歌单信息
type PlaylistInfo struct {
	ID       string       `json:"id"`
	Title    string       `json:"title"`
	Cover    string       `json:"cover"`
	Creator  string       `json:"creator"`
	Count    int          `json:"count"`
	Platform string       `json:"platform"`
	Songs    []*SongInfo  `json:"songs"`
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
}

// parsePlaylistURL 解析歌单链接
func (s *MusicService) ParsePlaylistURL(link string) (*PlaylistInfo, error) {
	// 网易云歌单
	if strings.Contains(link, "music.163.com") {
		id := parseNeteasePlaylistID(link)
		if id != "" {
			return s.FetchNeteasePlaylist(id)
		}
	}

	// QQ音乐歌单
	if strings.Contains(link, "y.qq.com") {
		id := parseQQPlaylistID(link)
		if id != "" {
			return s.FetchQQPlaylist(id)
		}
	}

	return nil, ErrUnsupportedMusicURL
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
	re := regexp.MustCompile(`/playlist/(\w+)`)
	matches := re.FindStringSubmatch(link)
	if len(matches) >= 2 {
		return matches[1]
	}
	re2 := regexp.MustCompile(`[?&]id=(\w+)`)
	matches2 := re2.FindStringSubmatch(link)
	if len(matches2) >= 2 {
		return matches2[1]
	}
	return ""
}

// FetchNeteasePlaylist 获取网易云歌单信息
// 使用公开 API 获取歌单详情
func (s *MusicService) FetchNeteasePlaylist(id string) (*PlaylistInfo, error) {
	// 网易云歌单详情 API
	apiURL := fmt.Sprintf("https://music.163.com/api/playlist/detail?id=%s", id)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	var result struct {
		Code int `json:"code"`
		Playlist struct {
			Name      string `json:"name"`
			CoverImgUrl string `json:"coverImgUrl"`
			Creator struct {
				Nickname string `json:"nickname"`
			} `json:"creator"`
			TrackCount int `json:"trackCount"`
			Tracks []struct {
				ID        int64  `json:"id"`
				Name      string `json:"name"`
				Ar        []struct {
					Name string `json:"name"`
				} `json:"ar"`
				Al struct {
					Name string `json:"name"`
					PicUrl string `json:"picUrl"`
				} `json:"al"`
				Dt int `json:"dt"` // 毫秒
			} `json:"tracks"`
		} `json:"playlist"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, ErrPlaylistAPI
	}

	if result.Code != 200 {
		return nil, ErrPlaylistNotFound
	}

	playlist := &PlaylistInfo{
		ID:       id,
		Title:    result.Playlist.Name,
		Cover:    result.Playlist.CoverImgUrl,
		Creator:  result.Playlist.Creator.Nickname,
		Count:    result.Playlist.TrackCount,
		Platform: "netease",
		Songs:    make([]*SongInfo, 0),
	}

	for _, track := range result.Playlist.Tracks {
		artists := make([]string, 0)
		for _, ar := range track.Ar {
			artists = append(artists, ar.Name)
		}

		song := &SongInfo{
			ID:       strconv.FormatInt(track.ID, 10),
			Title:    track.Name,
			Artist:   strings.Join(artists, "/"),
			Album:    track.Al.Name,
			Cover:    track.Al.PicUrl,
			Duration: track.Dt / 1000,
			URL:      fmt.Sprintf("https://music.163.com/song/media/outer/url?id=%d.mp3", track.ID),
		}
		playlist.Songs = append(playlist.Songs, song)
	}

	return playlist, nil
}

// FetchQQPlaylist 获取QQ音乐歌单信息
func (s *MusicService) FetchQQPlaylist(id string) (*PlaylistInfo, error) {
	// QQ音乐歌单 API
	apiURL := fmt.Sprintf("https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&ids=%s", id)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	// QQ音乐需要 Referer
	req.Header.Set("Referer", "https://y.qq.com/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	// QQ音乐返回 JSONP 格式，需要提取 JSON
	jsonBody := extractJSONP(body)

	var result struct {
		Code int `json:"code"`
		Data []struct {
			Dissname   string `json:"dissname"`
			Logo       string `json:"logo"`
			Nick       string `json:"nick"`
			Songnum    int    `json:"songnum"`
			Songlist []struct {
				Songmid   string `json:"songmid"`
			} `json:"songlist"`
		} `json:"data"`
	}

	if err := json.Unmarshal([]byte(jsonBody), &result); err != nil {
		return nil, ErrPlaylistAPI
	}

	if result.Code != 0 || len(result.Data) == 0 {
		return nil, ErrPlaylistNotFound
	}

	cd := result.Data[0]
	playlist := &PlaylistInfo{
		ID:       id,
		Title:    cd.Dissname,
		Cover:    cd.Logo,
		Creator:  cd.Nick,
		Count:    cd.Songnum,
		Platform: "qq",
		Songs:    make([]*SongInfo, 0),
	}

	// 获取歌曲详情
	for _, song := range cd.Songlist {
		songInfo := &SongInfo{
			ID:       song.Songmid,
			Platform: "qq",
			URL:      fmt.Sprintf("https://i.y.qq.com/v8/music/play/song?songmid=%s", song.Songmid),
		}
		playlist.Songs = append(playlist.Songs, songInfo)
	}

	return playlist, nil
}

// extractJSONP 从 JSONP 响应中提取 JSON
func extractJSONP(body []byte) string {
	str := string(body)
	// JSONP 格式: callback({...})
	start := strings.Index(str, "(")
	end := strings.LastIndex(str, ")")
	if start != -1 && end != -1 && end > start {
		return str[start+1:end]
	}
	return str
}

// FetchSongDetail 获取歌曲详情（用于获取播放链接）
func (s *MusicService) FetchSongDetail(platform, songID string) (*SongInfo, error) {
	switch platform {
	case "netease":
		return s.FetchNeteaseSongDetail(songID)
	case "qq":
		return s.FetchQQSongDetail(songID)
	default:
		return nil, ErrUnsupportedMusicURL
	}
}

// FetchNeteaseSongDetail 获取网易云歌曲详情
func (s *MusicService) FetchNeteaseSongDetail(id string) (*SongInfo, error) {
	apiURL := fmt.Sprintf("https://music.163.com/api/song/detail?ids=[%s]", id)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	var result struct {
		Code int `json:"code"`
		Songs []struct {
			ID        int64  `json:"id"`
			Name      string `json:"name"`
			Ar        []struct {
				Name string `json:"name"`
			} `json:"ar"`
			Al struct {
				Name string `json:"name"`
				PicUrl string `json:"picUrl"`
			} `json:"al"`
			Dt int `json:"dt"`
		} `json:"songs"`
	}

	if err := json.Unmarshal(body, &result); err != nil || result.Code != 200 {
		return nil, ErrPlaylistAPI
	}

	if len(result.Songs) == 0 {
		return nil, ErrPlaylistNotFound
	}

	song := result.Songs[0]
	artists := make([]string, 0)
	for _, ar := range song.Ar {
		artists = append(artists, ar.Name)
	}

	return &SongInfo{
		ID:       strconv.FormatInt(song.ID, 10),
		Title:    song.Name,
		Artist:   strings.Join(artists, "/"),
		Album:    song.Al.Name,
		Cover:    song.Al.PicUrl,
		Duration: song.Dt / 1000,
		URL:      fmt.Sprintf("https://music.163.com/song/media/outer/url?id=%d.mp3", song.ID),
	}, nil
}

// FetchQQSongDetail 获取QQ音乐歌曲详情
func (s *MusicService) FetchQQSongDetail(mid string) (*SongInfo, error) {
	apiURL := fmt.Sprintf("https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg?songmid=%s&format=json", mid)

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Referer", "https://y.qq.com/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	var result struct {
		Code int `json:"code"`
		Data []struct {
			Songmid string `json:"songmid"`
			Songname string `json:"songname"`
			Singer []struct {
				Name string `json:"name"`
			} `json:"singer"`
			Albumname string `json:"albumname"`
			Albummid string `json:"albummid"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil || result.Code != 0 {
		return nil, ErrPlaylistAPI
	}

	if len(result.Data) == 0 {
		return nil, ErrPlaylistNotFound
	}

	song := result.Data[0]
	artists := make([]string, 0)
	for _, s := range song.Singer {
		artists = append(artists, s.Name)
	}

	return &SongInfo{
		ID:       song.Songmid,
		Title:    song.Songname,
		Artist:   strings.Join(artists, "/"),
		Album:    song.Albumname,
		Cover:    fmt.Sprintf("https://y.qq.com/music/photo_new/T002R300x300M000%s.jpg", song.Albummid),
		URL:      fmt.Sprintf("https://i.y.qq.com/v8/music/play/song?songmid=%s", song.Songmid),
	}, nil
}