// Package song 的逐字歌词接口声明。
//
// GetWordLyric 走 eapi 新版歌词端点 /eapi/song/lyric/v1，返回的 yrc/ytlrc/yromalrc
// 字段是逐字歌词文本 blob，调 model.DecodeWordLyric 解析成结构化 WordLyric。
// 与纯文本 GetLyric（/weapi/song/lyric）分离：逐字歌词体积大，调用方按需取。
package song

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/model"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// WordLyricEP 是获取逐字歌词的接口声明。
// 命名加 EP 后缀避免与 proto message WordLyric 混淆（包级 var 用大写开头）。
var WordLyricEP = &engine.Endpoint[*mmpb.GetWordLyricRequest, *mmpb.GetWordLyricResponse]{
	Meta: engine.Meta{
		Path: "/eapi/song/lyric/v1", Method: "POST",
		Crypto: engine.CryptoEAPI, Auth: session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.GetWordLyricRequest]{
		Key: func(req *mmpb.GetWordLyricRequest) string {
			return fmt.Sprintf("song:wordLyric:%d", req.GetSongId())
		},
		TTL: 24 * time.Hour,
	},
	NewResp: func() *mmpb.GetWordLyricResponse { return &mmpb.GetWordLyricResponse{} },
	MapRequest: func(req *mmpb.GetWordLyricRequest) (map[string]any, error) {
		// tv/lv/rv/kv/yv/ytv/yrv = 0 表示返回各类歌词；cp=false。
		return map[string]any{
			"id":  req.GetSongId(),
			"cp":  false,
			"tv":  0,
			"lv":  0,
			"rv":  0,
			"kv":  0,
			"yv":  0,
			"ytv": 0,
			"yrv": 0,
		}, nil
	},
	MapResponse: func(req *mmpb.GetWordLyricRequest, raw json.RawMessage) (*mmpb.GetWordLyricResponse, error) {
		var resp struct {
			Yrc struct {
				Lyric string `json:"lyric"`
			} `json:"yrc"` // 逐字原文
			Ytlrc struct {
				Lyric string `json:"lyric"`
			} `json:"ytlrc"` // 逐字翻译
			Yromalrc struct {
				Lyric string `json:"lyric"`
			} `json:"yromalrc"` // 逐字音译
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return &mmpb.GetWordLyricResponse{}, fmt.Errorf("解析逐字歌词响应失败: %w", err)
		}
		wordLyric, err := model.DecodeWordLyric(resp.Yrc.Lyric)
		if err != nil {
			return &mmpb.GetWordLyricResponse{}, fmt.Errorf("解析逐字原文失败: %w", err)
		}
		if t, err := model.DecodeWordLyric(resp.Ytlrc.Lyric); err == nil {
			wordLyric.TranslatedLines = t.Lines
		}
		if r, err := model.DecodeWordLyric(resp.Yromalrc.Lyric); err == nil {
			wordLyric.RomanizedLines = r.Lines
		}
		return &mmpb.GetWordLyricResponse{WordLyric: wordLyric}, nil
	},
}
