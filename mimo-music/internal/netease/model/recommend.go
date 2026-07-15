// Package model 的每日推荐解码。
package model

import (
	"encoding/json"
	"fmt"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// rawRecommendDaily 是网易云每日推荐接口的响应。
type rawRecommendDaily struct {
	Code int `json:"code"`
	Data struct {
		DailySongs []rawSong `json:"dailySongs"`
	} `json:"data"`
}

// DecodeDailyRecommend 解析每日推荐响应的原始 JSON。
func DecodeDailyRecommend(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawRecommendDaily
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析每日推荐失败: %w", err)
	}
	return MapSongs(r.Data.DailySongs), nil
}

// rawFMPersonal 是网易云私人 FM 接口的响应。
type rawFMPersonal struct {
	Code int       `json:"code"`
	Data []rawSong `json:"data"`
}

// DecodePersonalFM 解析私人 FM 响应的原始 JSON。
func DecodePersonalFM(raw json.RawMessage) ([]*mmpb.Song, error) {
	var r rawFMPersonal
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("解析私人 FM 失败: %w", err)
	}
	return MapSongs(r.Data), nil
}
