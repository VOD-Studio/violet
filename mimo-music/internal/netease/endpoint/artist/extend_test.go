// Package artist 的扩展查询接口 MapResponse 测试。
package artist

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestAllSongs_MapResponse 歌手全部歌曲解析。
func TestAllSongs_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"total":1,"songs":[{"id":1,"name":"歌A","ar":[{"id":100,"name":"歌手"}],"al":{"id":10,"name":"专辑","picUrl":"http://c.jpg"},"dt":180000}]}`

	resp, err := AllSongs.MapResponse(&mmpb.AllSongsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, "歌A", resp.Songs[0].Name)
	require.Equal(t, int32(1), resp.Total)
}

// TestAlbums_MapResponse 歌手专辑列表解析。
func TestAlbums_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"more":false,"hotAlbums":[{"id":10,"name":"专辑B","picUrl":"http://a.jpg","artist":{"id":100,"name":"歌手"}}]}`

	resp, err := Albums.MapResponse(&mmpb.AlbumsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 1)
	require.Equal(t, "专辑B", resp.Albums[0].Name)
	require.False(t, resp.More)
}

// TestDesc_MapResponse 歌手描述解析。
func TestDesc_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"briefDesc":"华语流行歌手"}`

	resp, err := Desc.MapResponse(&mmpb.DescRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "华语流行歌手", resp.Desc)
}

// TestSimilar_MapResponse 相似歌手解析。
func TestSimilar_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"artists":[{"id":200,"name":"相似A","img1v1Url":"http://s.jpg"}]}`

	resp, err := Similar.MapResponse(&mmpb.SimilarRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Artists, 1)
	require.Equal(t, "相似A", resp.Artists[0].Name)
}

// TestFans_MapResponse 粉丝数解析。
func TestFans_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"data":{"fansCount":999999}}`

	resp, err := Fans.MapResponse(&mmpb.FansRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(999999), resp.Fans)
}

// TestTopArtists_MapResponse 热门歌手列表解析。
func TestTopArtists_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"artists":[{"id":1,"name":"周杰伦","img1v1Url":"http://j.jpg"}]}`

	resp, err := TopArtists.MapResponse(&mmpb.TopArtistsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Artists, 1)
	require.Equal(t, "周杰伦", resp.Artists[0].Name)
}

// TestParseSubscribeResponse 收藏响应解析。
func TestParseSubscribeResponse(t *testing.T) {
	t.Parallel()

	resp := ParseSubscribeResponse(json.RawMessage(`{"sub":true}`))
	require.True(t, resp.Subscribed)
}
