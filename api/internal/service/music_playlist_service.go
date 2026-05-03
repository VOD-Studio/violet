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
	Lrc      string `json:"lrc,omitempty"`
}

// parsePlaylistURL 解析歌单链接
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

// FetchQQPlaylistFromShortLink 从 QQ 音乐短链接获取歌单信息
func (s *MusicService) FetchQQPlaylistFromShortLink(shortLink string) (*PlaylistInfo, error) {
	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest("GET", shortLink, nil)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	htmlStr := string(body)

	// 从 og:url 提取歌单 ID
	reURL := regexp.MustCompile(`<meta property="og:url" content="([^"]+)"`)
	matchesURL := reURL.FindStringSubmatch(htmlStr)
	if len(matchesURL) < 2 {
		return nil, ErrPlaylistNotFound
	}

	playlistID := parseQQPlaylistID(matchesURL[1])
	if playlistID == "" {
		return nil, ErrPlaylistNotFound
	}

	// 从 HTML 提取歌单标题
	title := "QQ音乐歌单"
	reTitle := regexp.MustCompile(`<title>([^<]+)-QQ音乐`)
	matchesTitle := reTitle.FindStringSubmatch(htmlStr)
	if len(matchesTitle) >= 2 {
		title = strings.TrimSpace(matchesTitle[1])
	}

	// 从 HTML 提取歌单封面（og:image）
	cover := ""
	reCover := regexp.MustCompile(`<meta property="og:image" content="([^"]+)"`)
	matchesCover := reCover.FindStringSubmatch(htmlStr)
	if len(matchesCover) >= 2 {
		cover = matchesCover[1]
	}

	// 从 HTML 提取创建者信息
	creator := ""
	reCreator := regexp.MustCompile(`<meta property="music:playlist_creator" content="([^"]+)"`)
	matchesCreator := reCreator.FindStringSubmatch(htmlStr)
	if len(matchesCreator) >= 2 {
		creator = matchesCreator[1]
	}

	// 从 Meting API 获取歌曲列表
	songList := make([]*SongInfo, 0)
	metingURL := fmt.Sprintf("https://api.injahow.cn/meting/?server=tencent&type=playlist&id=%s", playlistID)
	req2, err := http.NewRequest("GET", metingURL, nil)
	if err == nil {
		req2.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
		resp2, err := client.Do(req2)
		if err == nil {
			defer resp2.Body.Close()
			body2, _ := io.ReadAll(resp2.Body)
			var metingSongs []struct {
				Name   string `json:"name"`
				Artist string `json:"artist"`
				URL    string `json:"url"`
				Pic    string `json:"pic"`
				Lrc    string `json:"lrc"`
			}
			if json.Unmarshal(body2, &metingSongs) == nil {
				for i, s := range metingSongs {
					if s.URL == "" || !strings.HasPrefix(s.URL, "http") {
						continue
					}
					songList = append(songList, &SongInfo{
						ID:       fmt.Sprintf("tencent-%s-%d", playlistID, i),
						Title:    s.Name,
						Artist:   s.Artist,
						Cover:    s.Pic,
						URL:      s.URL,
						Platform: "tencent",
					})
				}
				// 如果没有从 HTML 获取到封面，使用第一首歌的封面
				if cover == "" && len(metingSongs) > 0 && metingSongs[0].Pic != "" {
					cover = metingSongs[0].Pic
				}
			}
		}
	}

	return &PlaylistInfo{
		ID:       playlistID,
		Title:    title,
		Cover:    cover,
		Creator:  creator,
		Platform: "tencent",
		Count:    len(songList),
		Songs:    songList,
	}, nil
}

// resolveQQShortLink 解析 QQ 音乐短链接，获取跳转后的真实 URL
func resolveQQShortLink(shortLink string) string {
	client := &http.Client{Timeout: 5 * time.Second}

	req, err := http.NewRequest("GET", shortLink, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	// QQ 音乐短链接返回 200，使用 JS 跳转
	// 需要从 HTML 中提取 og:url meta 标签
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	// 从 og:url meta 标签提取歌单 URL
	re := regexp.MustCompile(`<meta property="og:url" content="([^"]+)"`)
	matches := re.FindStringSubmatch(string(body))
	if len(matches) >= 2 {
		return matches[1]
	}

	return ""
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

// FetchNeteasePlaylist 获取网易云歌单信息
// 使用 Meting API 获取完整歌单信息
func (s *MusicService) FetchNeteasePlaylist(id string) (*PlaylistInfo, error) {
	// 使用 Meting API 获取完整歌单信息
	metingURL := fmt.Sprintf("https://api.injahow.cn/meting/?server=netease&type=playlist&id=%s", id)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", metingURL, nil)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, ErrPlaylistAPI
	}

	// Meting API 返回歌曲数组
	var songs []struct {
		Name   string `json:"name"`
		Artist string `json:"artist"`
		URL    string `json:"url"`
		Pic    string `json:"pic"`
		Lrc    string `json:"lrc"`
	}

	if err := json.Unmarshal(body, &songs); err != nil {
		return nil, ErrPlaylistAPI
	}

	if len(songs) == 0 {
		return nil, ErrPlaylistNotFound
	}

	// 从第一首歌提取封面作为歌单封面
	cover := ""
	if len(songs) > 0 {
		cover = songs[0].Pic
	}

	// 同时从网易云 API 获取歌单标题和创建者
	playlistTitle := "网易云音乐歌单"
	playlistCreator := ""
	playlistCover := cover

	// 尝试获取歌单基本信息
	apiURL := fmt.Sprintf("https://music.163.com/api/playlist/detail?id=%s", id)
	resp2, err := client.Get(apiURL)
	if err == nil {
		defer resp2.Body.Close()
		body2, _ := io.ReadAll(resp2.Body)
		var result struct {
			Code int `json:"code"`
			Result struct {
				Name        string `json:"name"`
				CoverImgUrl string `json:"coverImgUrl"`
				Creator     struct {
					Nickname string `json:"nickname"`
				} `json:"creator"`
			} `json:"result"`
		}
		if json.Unmarshal(body2, &result) == nil && result.Code == 200 {
			playlistTitle = result.Result.Name
			playlistCreator = result.Result.Creator.Nickname
			if result.Result.CoverImgUrl != "" {
				playlistCover = result.Result.CoverImgUrl
			}
		}
	}

	// Convert Meting API response to SongInfo
	songList := make([]*SongInfo, 0, len(songs))
	for i, s := range songs {
		if s.URL == "" || !strings.HasPrefix(s.URL, "http") {
			continue
		}
		songList = append(songList, &SongInfo{
			ID:       fmt.Sprintf("netease-%s-%d", id, i),
			Title:    s.Name,
			Artist:   s.Artist,
			Cover:    s.Pic,
			URL:      s.URL,
			Platform: "netease",
		})
	}

	playlist := &PlaylistInfo{
		ID:       id,
		Title:    playlistTitle,
		Cover:    playlistCover,
		Creator:  playlistCreator,
		Count:    len(songList),
		Platform: "netease",
		Songs:    songList,
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
		Platform: "tencent",
		Songs:    make([]*SongInfo, 0),
	}

	// 获取歌曲详情
	for _, song := range cd.Songlist {
		songInfo := &SongInfo{
			ID:       song.Songmid,
			Platform: "tencent",
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
	case "tencent":
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