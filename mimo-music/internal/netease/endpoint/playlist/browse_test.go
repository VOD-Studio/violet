// Package playlist 的浏览接口 MapResponse 测试。
package playlist

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestHighQuality_MapResponse 精品歌单列表解析。
func TestHighQuality_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"total":1,"playlists":[{"id":1,"name":"精品A","coverImgUrl":"http://c.jpg","playCount":999,"trackCount":30,"creator":{"nickname":"dj"}}]}`

	resp, err := HighQuality.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Playlists, 1)
	require.Equal(t, "精品A", resp.Playlists[0].Name)
	require.Equal(t, int32(1), resp.Total)
}

// TestHighQualityTags_MapResponse 精品标签解析。
func TestHighQualityTags_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"tags":[{"name":"华语","category":"语种"},{"name":"流行","category":"风格"}]}`

	resp, err := HighQualityTags.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Tags, 2)
	require.Equal(t, "华语", resp.Tags[0].Name)
}

// TestCatList_MapResponse 歌单分类解析。
func TestCatList_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"sub":[{"name":"华语","resourceCount":1000,"type":1},{"name":"流行","resourceCount":2000,"type":2}]}`

	resp, err := CatList.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Categories, 2)
	require.Equal(t, int64(1000), resp.Categories[0].ResourceCount)
}

// TestBrowseHot_MapResponse 热门歌单解析。
func TestBrowseHot_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"total":1,"playlists":[{"id":5,"name":"热门B","coverImgUrl":"http://h.jpg","playCount":500,"trackCount":20,"creator":{"nickname":"u"}}]}`

	resp, err := BrowseHot.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Playlists, 1)
	require.Equal(t, "热门B", resp.Playlists[0].Name)
}

// TestSubscribers_MapResponse 收藏者列表解析。
func TestSubscribers_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"subscribers":[{"userId":1,"nickname":"alice","avatarUrl":"http://a.jpg"},{"userId":2,"nickname":"bob","avatarUrl":"http://b.jpg"}]}`

	resp, err := Subscribers.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Subscribers, 2)
	require.Equal(t, "alice", resp.Subscribers[0].Nickname)
	require.Equal(t, int32(2), resp.Total)
}
