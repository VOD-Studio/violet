// Package recommend 的推荐扩展接口测试。
package recommend

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
)

// TestDailyRecommendPlaylists_CacheNil per-user 结果不缓存。
func TestDailyRecommendPlaylists_CacheNil(t *testing.T) {
	t.Parallel()
	if DailyRecommendPlaylists.Cache != nil {
		t.Error("每日推荐歌单是 per-user，应不缓存")
	}
}

// TestDailyRecommendPlaylists_MapResponse 解析 recommend[]。
func TestDailyRecommendPlaylists_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"recommend":[{"id":1,"name":"日推歌单","picUrl":"http://a.jpg","playCount":500,"trackCount":20,"creator":{"userId":10,"nickname":"小编"}}]}`
	resp, err := DailyRecommendPlaylists.MapResponse(&mmpb.DailyRecommendPlaylistsRequest{}, json.RawMessage(fixture))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(resp.Playlists) != 1 {
		t.Fatalf("歌单数 = %d, 期望 1", len(resp.Playlists))
	}
	if resp.Playlists[0].Name != "日推歌单" {
		t.Errorf("歌单名 = %q", resp.Playlists[0].Name)
	}
}

// TestRecommendPlaylists_MapRequest limit 默认值。
func TestRecommendPlaylists_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := RecommendPlaylists.MapRequest(&mmpb.RecommendPlaylistsRequest{})
	if err != nil {
		t.Fatalf("MapRequest 失败: %v", err)
	}
	if params["limit"] != int32(30) {
		t.Errorf("limit = %v, 期望 int32(30)", params["limit"])
	}
	if params["n"] != 1000 {
		t.Errorf("n = %v, 期望 1000", params["n"])
	}
}

// TestRecommendPlaylists_MapResponse 解析 result[]。
func TestRecommendPlaylists_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":[{"id":2,"name":"热门歌单","coverImgUrl":"http://b.jpg","playCount":999,"trackCount":25,"creator":{"userId":20,"nickname":"运营"}}]}`
	resp, err := RecommendPlaylists.MapResponse(&mmpb.RecommendPlaylistsRequest{}, json.RawMessage(fixture))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(resp.Playlists) != 1 {
		t.Fatalf("歌单数 = %d, 期望 1", len(resp.Playlists))
	}
	if resp.Playlists[0].CoverUrl != "http://b.jpg" {
		t.Errorf("封面 = %q", resp.Playlists[0].CoverUrl)
	}
}

// TestRecommendNewSongs_MapRequest limit 默认值。
func TestRecommendNewSongs_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := RecommendNewSongs.MapRequest(&mmpb.RecommendNewSongsRequest{})
	if err != nil {
		t.Fatalf("MapRequest 失败: %v", err)
	}
	if params["limit"] != int32(10) {
		t.Errorf("limit = %v, 期望 int32(10)", params["limit"])
	}
	if params["type"] != "recommend" {
		t.Errorf("type = %v, 期望 recommend", params["type"])
	}
}

// TestRecommendNewSongs_MapResponse 解析嵌套 result[i].song。
func TestRecommendNewSongs_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":[{"id":100,"song":{"id":1,"name":"新歌","artists":[{"id":10,"name":"新人"}],"album":{"id":20,"name":"新专","picUrl":"http://c.jpg"},"duration":200000,"fee":0}}]}`
	resp, err := RecommendNewSongs.MapResponse(&mmpb.RecommendNewSongsRequest{}, json.RawMessage(fixture))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(resp.Songs) != 1 {
		t.Fatalf("歌曲数 = %d, 期望 1", len(resp.Songs))
	}
	if resp.Songs[0].Name != "新歌" {
		t.Errorf("歌曲名 = %q", resp.Songs[0].Name)
	}
	if resp.Songs[0].Artists[0].Name != "新人" {
		t.Errorf("歌手名 = %q", resp.Songs[0].Artists[0].Name)
	}
}
