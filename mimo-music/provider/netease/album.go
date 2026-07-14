// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/VOD-Studio/mimo-music/provider"
)

// AlbumService 是网易云专辑能力服务。
type AlbumService struct{ client *Client }

// Detail 获取专辑详情（含歌曲列表）。
//
// 网易云 /weapi/v1/album/detail 返回专辑元数据 + 歌曲列表。
func (a *AlbumService) Detail(ctx context.Context, albumID string) (provider.AlbumResult, error) {
	payload := fmt.Sprintf(`{"id":"%s"}`, albumID)
	body, _, err := a.client.weapiPost(ctx, "/weapi/v1/album/detail", payload, a.client.getCookie(""))
	if err != nil {
		return provider.AlbumResult{}, err
	}

	var resp neteaseAlbumDetail
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.AlbumResult{}, fmt.Errorf("解析专辑详情失败: %w", err)
	}

	al := resp.Album
	songs := make([]provider.SongResult, 0, len(resp.Songs))
	for _, s := range resp.Songs {
		songs = append(songs, toSongResult(s))
	}

	return provider.AlbumResult{
		ID:          fmt.Sprintf("%d", al.ID),
		Name:        al.Name,
		Cover:       al.PicUrl,
		Artist:      joinArtistsRaw(al.Artists),
		PublishTime: al.PublishTime,
		Songs:       songs,
	}, nil
}

// neteaseAlbumDetail 是网易云专辑详情响应结构。
type neteaseAlbumDetail struct {
	// Album 是专辑信息。
	Album struct {
		// ID 是专辑 ID。
		ID int64 `json:"id"`
		// Name 是专辑名。
		Name string `json:"name"`
		// PicUrl 是封面 URL。
		PicUrl string `json:"picUrl"`
		// PublishTime 是发行时间（毫秒时间戳）。
		PublishTime string `json:"publishTime"`
		// Artists 是歌手数组。
		Artists []struct {
			Name string `json:"name"`
		} `json:"artists"`
	} `json:"album"`

	// Songs 是专辑歌曲列表。
	Songs []neteaseSongDetailSongs `json:"songs"`
}

// joinArtistsRaw 把歌手数组合并为 "歌手1/歌手2" 格式（专辑/歌手场景的原始数组用）。
func joinArtistsRaw(artists []struct {
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
