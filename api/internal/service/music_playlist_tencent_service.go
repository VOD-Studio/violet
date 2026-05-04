// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// FetchQQPlaylistFromShortLink 从 QQ 音乐短链接获取歌单信息
func (s *MusicService) FetchQQPlaylistFromShortLink(shortLink string) (*PlaylistInfo, error) {
	log.Info().Str("service", "MusicService").Str("operation", "FetchQQPlaylistFromShortLink").
		Str("url", shortLink).Msg("开始解析QQ音乐短链接")

	client := &http.Client{Timeout: 10 * time.Second}

	req, err := http.NewRequest("GET", shortLink, nil)
	if err != nil {
		log.Error().Err(err).Msg("创建请求失败")
		return nil, ErrPlaylistAPI
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	log.Info().Str("target", "QQMusicAPI").Msg("调用QQ音乐API")
	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("请求失败")
		return nil, ErrPlaylistAPI
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Error().Err(err).Msg("读取响应失败")
		return nil, ErrPlaylistAPI
	}

	htmlStr := string(body)

	// 从 og:url 提取歌单 ID
	reURL := regexp.MustCompile(`<meta property="og:url" content="([^"]+)"`)
	matchesURL := reURL.FindStringSubmatch(htmlStr)
	if len(matchesURL) < 2 {
		log.Warn().Msg("未找到歌单URL")
		return nil, ErrPlaylistNotFound
	}

	playlistID := parseQQPlaylistID(matchesURL[1])
	if playlistID == "" {
		log.Warn().Msg("解析歌单ID失败")
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

	log.Info().Str("playlist_id", playlistID).Str("title", title).Int("songs", len(songList)).Msg("QQ音乐歌单解析成功")
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
			Dissname string `json:"dissname"`
			Logo     string `json:"logo"`
			Nick     string `json:"nick"`
			Songnum  int    `json:"songnum"`
			Songlist []struct {
				Songmid string `json:"songmid"`
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
			Songmid   string `json:"songmid"`
			Songname  string `json:"songname"`
			Singer    []struct {
				Name string `json:"name"`
			} `json:"singer"`
			Albumname string `json:"albumname"`
			Albummid  string `json:"albummid"`
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
