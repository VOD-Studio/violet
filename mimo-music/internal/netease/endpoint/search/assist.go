// Package search 的辅助接口声明（建议/热搜/默认词）。
package search

import (
	"encoding/json"
	"fmt"
	"time"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/VOD-Studio/mimo-music/internal/netease/engine"
	"github.com/VOD-Studio/mimo-music/internal/netease/session"
)

// Suggest 是搜索建议接口声明。
// path 必须是 /api/search/suggest/web:/api/search/suggest 真机返回空 result。
var Suggest = &engine.Endpoint[*mmpb.SuggestRequest, *mmpb.SuggestResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/suggest/web",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.SuggestRequest]{
		Key: func(req *mmpb.SuggestRequest) string {
			return fmt.Sprintf("search:suggest:%s", req.GetKeyword())
		},
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.SuggestResponse { return &mmpb.SuggestResponse{} },
	MapRequest: func(req *mmpb.SuggestRequest) (map[string]any, error) {
		return map[string]any{"s": req.GetKeyword()}, nil
	},
	MapResponse: func(req *mmpb.SuggestRequest, raw json.RawMessage) (*mmpb.SuggestResponse, error) {
		var resp struct {
			Result struct {
				Songs     []struct{ Name string `json:"name"` } `json:"songs"`
				Albums    []struct{ Name string `json:"name"` } `json:"albums"`
				Artists   []struct{ Name string `json:"name"` } `json:"artists"`
				Playlists []struct{ Name string `json:"name"` } `json:"playlists"`
			} `json:"result"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析搜索建议失败: %w", err)
		}
		out := &mmpb.SuggestResponse{}
		for _, s := range resp.Result.Songs {
			out.Songs = append(out.Songs, s.Name)
		}
		for _, a := range resp.Result.Albums {
			out.Albums = append(out.Albums, a.Name)
		}
		for _, a := range resp.Result.Artists {
			out.Artists = append(out.Artists, a.Name)
		}
		for _, p := range resp.Result.Playlists {
			out.Playlists = append(out.Playlists, p.Name)
		}
		return out, nil
	},
}

// Hot 是热搜词列表（简略）接口声明。
var Hot = &engine.Endpoint[*mmpb.HotRequest, *mmpb.HotResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/hot",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.HotRequest]{
		Key: func(*mmpb.HotRequest) string { return "search:hot" },
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.HotResponse { return &mmpb.HotResponse{} },
	MapRequest: func(*mmpb.HotRequest) (map[string]any, error) {
		return map[string]any{"type": 1111}, nil
	},
	MapResponse: func(req *mmpb.HotRequest, raw json.RawMessage) (*mmpb.HotResponse, error) {
		// 真机响应: {"code":200,"result":{"hots":[{"first":"薛之谦","second":1,"iconType":1}]}}
		// first=热搜词 second=排名;无 iconUrl 字段。
		var resp struct {
			Result struct {
				Hots []struct {
					First  string `json:"first"`
					Second int32  `json:"second"`
				} `json:"hots"`
			} `json:"result"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析热搜失败: %w", err)
		}
		out := &mmpb.HotResponse{}
		for _, h := range resp.Result.Hots {
			out.Keywords = append(out.Keywords, &mmpb.HotKeyword{
				SearchWord: h.First, Score: h.Second,
			})
		}
		return out, nil
	},
}

// HotDetail 是热搜词列表（详细）接口声明。
var HotDetail = &engine.Endpoint[*mmpb.HotDetailRequest, *mmpb.HotDetailResponse]{
	Meta: engine.Meta{
		Path:   "/api/hotsearchlist/get",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.HotDetailRequest]{
		Key: func(*mmpb.HotDetailRequest) string { return "search:hot:detail" },
		TTL: 10 * time.Minute,
	},
	NewResp: func() *mmpb.HotDetailResponse { return &mmpb.HotDetailResponse{} },
	MapRequest: func(*mmpb.HotDetailRequest) (map[string]any, error) {
		return map[string]any{}, nil
	},
	MapResponse: func(req *mmpb.HotDetailRequest, raw json.RawMessage) (*mmpb.HotDetailResponse, error) {
		var resp struct {
			Data []struct {
				SearchWord string `json:"searchWord"`
				Score      int32  `json:"score"`
				Position   int32  `json:"position"`
				CoverUrl   string `json:"coverImgUrl"`
				IconUrl    string `json:"iconUrl"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析热搜详细失败: %w", err)
		}
		out := &mmpb.HotDetailResponse{}
		for _, d := range resp.Data {
			out.Details = append(out.Details, &mmpb.HotDetail{
				SearchWord: d.SearchWord, Score: d.Score, Position: d.Position,
				CoverUrl: d.CoverUrl, IconUrl: d.IconUrl,
			})
		}
		return out, nil
	},
}

// DefaultKeyword 是默认搜索词接口声明。
var DefaultKeyword = &engine.Endpoint[*mmpb.DefaultKeywordRequest, *mmpb.DefaultKeywordResponse]{
	Meta: engine.Meta{
		Path:   "/api/search/defaultkeyword/get",
		Method: "GET",
		Crypto: engine.CryptoNone,
		Auth:   session.AuthAnonymous,
	},
	Cache: &engine.CachePolicy[*mmpb.DefaultKeywordRequest]{
		Key: func(*mmpb.DefaultKeywordRequest) string { return "search:default" },
		TTL: time.Hour,
	},
	NewResp: func() *mmpb.DefaultKeywordResponse { return &mmpb.DefaultKeywordResponse{} },
	MapRequest: func(*mmpb.DefaultKeywordRequest) (map[string]any, error) {
		return map[string]any{}, nil
	},
	MapResponse: func(req *mmpb.DefaultKeywordRequest, raw json.RawMessage) (*mmpb.DefaultKeywordResponse, error) {
		var resp struct {
			Data struct {
				Keyword string `json:"realkeyword"`
			} `json:"data"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, fmt.Errorf("解析默认搜索词失败: %w", err)
		}
		return &mmpb.DefaultKeywordResponse{Keyword: resp.Data.Keyword}, nil
	},
}
