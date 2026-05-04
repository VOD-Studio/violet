// Package service 提供业务逻辑层，封装数据访问和业务规则
package service

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

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
			ID int64  `json:"id"`
			Name string `json:"name"`
			Ar []struct {
				Name string `json:"name"`
			} `json:"ar"`
			Al struct {
				Name   string `json:"name"`
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
