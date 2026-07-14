// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/VOD-Studio/mimo-music/provider"
)

// RecommendService 是网易云推荐能力服务。
type RecommendService struct{ client *Client }

// Daily 获取每日推荐歌曲（需登录）。
//
// 网易云 /weapi/v3/discovery/recommend/songs 返回每日推荐 30 首。
// 必须带有效登录 Cookie，否则返回未登录错误。
func (r *RecommendService) Daily(ctx context.Context, cookie string) ([]provider.SongResult, error) {
	payload := `{"limit":30,"offset":0,"total":true,"n":1000}`
	body, _, err := r.client.weapiPost(ctx, "/weapi/v3/discovery/recommend/songs", payload, r.client.getCookie(cookie))
	if err != nil {
		return nil, err
	}

	var resp neteaseRecommendDaily
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("解析每日推荐失败: %w", err)
	}

	songs := make([]provider.SongResult, 0, len(resp.Data.DailySongs))
	for _, s := range resp.Data.DailySongs {
		songs = append(songs, toSongResult(s))
	}
	return songs, nil
}

// neteaseRecommendDaily 是网易云每日推荐响应结构。
type neteaseRecommendDaily struct {
	// Data 是推荐数据。
	Data struct {
		// DailySongs 是每日推荐歌曲列表。
		DailySongs []neteaseSongDetailSongs `json:"dailySongs"`
	} `json:"data"`
}
