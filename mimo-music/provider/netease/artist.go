// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/VOD-Studio/mimo-music/provider"
)

// ArtistService 是网易云歌手能力服务。
type ArtistService struct{ client *Client }

// Info 获取歌手信息及热门歌曲。
//
// 网易云 /weapi/artist/get 返回歌手信息 + 热门歌曲（默认 50 首）。
func (a *ArtistService) Info(ctx context.Context, artistID string) (provider.ArtistResult, error) {
	payload := fmt.Sprintf(`{"id":"%s","top":50,"offset":0}`, artistID)
	body, _, err := a.client.weapiPost(ctx, "/weapi/artist/get", payload, a.client.getCookie(""))
	if err != nil {
		return provider.ArtistResult{}, err
	}

	var resp neteaseArtistInfo
	if err := json.Unmarshal(body, &resp); err != nil {
		return provider.ArtistResult{}, fmt.Errorf("解析歌手信息失败: %w", err)
	}

	ar := resp.Artist
	songs := make([]provider.SongResult, 0, len(resp.HotSongs))
	for _, s := range resp.HotSongs {
		songs = append(songs, toSongResult(s))
	}

	return provider.ArtistResult{
		ID:          fmt.Sprintf("%d", ar.ID),
		Name:        ar.Name,
		Cover:       ar.Img1v1URL,
		Description: ar.BriefDesc,
		Songs:       songs,
	}, nil
}

// neteaseArtistInfo 是网易云歌手信息响应结构。
type neteaseArtistInfo struct {
	// Artist 是歌手信息。
	Artist struct {
		// ID 是歌手 ID。
		ID int64 `json:"id"`
		// Name 是歌手名。
		Name string `json:"name"`
		// Img1v1URL 是歌手封面 URL。
		Img1v1URL string `json:"img1v1Url"`
		// BriefDesc 是歌手简介。
		BriefDesc string `json:"briefDesc"`
	} `json:"artist"`

	// HotSongs 是热门歌曲列表。
	HotSongs []neteaseSongDetailSongs `json:"hotSongs"`
}
