// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/VOD-Studio/mimo-music/provider"
)

// FMService 是网易云私人电台能力服务。
type FMService struct{ client *Client }

// Personal 获取私人 FM 歌曲（需登录）。
//
// 网易云 /weapi/v1/radio/get 返回私人 FM 推荐 3 首。
// 必须带有效登录 Cookie，否则返回未登录错误。
func (f *FMService) Personal(ctx context.Context, cookie string) ([]provider.SongResult, error) {
	body, _, err := f.client.weapiPost(ctx, "/weapi/v1/radio/get", "{}", f.client.getCookie(cookie))
	if err != nil {
		return nil, err
	}

	var resp neteaseFMPersonal
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("解析私人 FM 失败: %w", err)
	}

	songs := make([]provider.SongResult, 0, len(resp.Data))
	for _, s := range resp.Data {
		songs = append(songs, toSongResult(s))
	}
	return songs, nil
}

// neteaseFMPersonal 是网易云私人 FM 响应结构。
type neteaseFMPersonal struct {
	// Data 是 FM 歌曲列表。
	Data []neteaseSongDetailSongs `json:"data"`
}
