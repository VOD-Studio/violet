// Package album 的 endpoint MapResponse 测试。
package album

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestGetAlbum_MapResponse 专辑详情解析。
func TestGetAlbum_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"album":{"id":10,"name":"乐与怒","picUrl":"http://c.jpg","publishTime":"1993-06-08","artists":[{"id":20,"name":"Beyond"}]},"songs":[{"id":1,"name":"海阔天空","ar":[{"id":20,"name":"Beyond"}],"al":{"id":10,"name":"乐与怒"},"dt":326000,"fee":0}]}`

	resp, err := GetAlbum.MapResponse(&mmpb.GetAlbumRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "乐与怒", resp.Album.Name)
	require.Equal(t, "Beyond", resp.Album.Artist.Name)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, "海阔天空", resp.Songs[0].Name)
}

// --- 专辑扩展测试 ---

// TestAreaToString 地区 enum 转网易云字符串。
func TestAreaToString(t *testing.T) {
	t.Parallel()

	tests := []struct {
		area mmpb.AlbumArea
		want string
	}{
		{mmpb.AlbumArea_ALBUM_AREA_ZH, "ZH"},
		{mmpb.AlbumArea_ALBUM_AREA_EA, "EA"},
		{mmpb.AlbumArea_ALBUM_AREA_KR, "KR"},
		{mmpb.AlbumArea_ALBUM_AREA_JP, "JP"},
		{mmpb.AlbumArea_ALBUM_AREA_ALL, "ALL"},
		{mmpb.AlbumArea_ALBUM_AREA_UNSPECIFIED, "ALL"},
	}
	for _, tt := range tests {
		got := areaToString(tt.area)
		require.Equal(t, tt.want, got)
	}
}

// TestNewestAlbums_MapResponse 最新专辑列表解析。
func TestNewestAlbums_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"albums":[{"id":1,"name":"新专A","picUrl":"http://a.jpg","artist":{"id":10,"name":"歌手A"}},{"id":2,"name":"新专B","picUrl":"http://b.jpg","artist":{"id":11,"name":"歌手B"}}]}`
	resp, err := NewestAlbums.MapResponse(&mmpb.NewestAlbumsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 2)
	require.Equal(t, "新专A", resp.Albums[0].Name)
	require.Equal(t, "歌手B", resp.Albums[1].Artist.Name)
}

// TestAllNewAlbums_MapRequest limit 默认值 + area 转换。
func TestAllNewAlbums_MapRequest(t *testing.T) {
	t.Parallel()

	t.Run("默认limit30", func(t *testing.T) {
		t.Parallel()
		params, err := AllNewAlbums.MapRequest(&mmpb.AllNewAlbumsRequest{Area: mmpb.AlbumArea_ALBUM_AREA_KR})
		require.NoError(t, err)
		require.Equal(t, int32(30), params["limit"])
		require.Equal(t, "KR", params["area"])
		require.Equal(t, true, params["total"])
	})
	t.Run("自定义limit", func(t *testing.T) {
		t.Parallel()
		params, _ := AllNewAlbums.MapRequest(&mmpb.AllNewAlbumsRequest{Limit: 10, Offset: 20})
		require.Equal(t, int32(10), params["limit"])
		require.Equal(t, int32(20), params["offset"])
	})
}

// TestAllNewAlbums_MapResponse 带总数的列表解析。
func TestAllNewAlbums_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"albums":[{"id":1,"name":"A"}],"total":100}`
	resp, err := AllNewAlbums.MapResponse(&mmpb.AllNewAlbumsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 1)
	require.Equal(t, int32(100), resp.Total)
}

// TestNewAlbumShelf_MapRequest year/month 默认当前、type 默认 new。
func TestNewAlbumShelf_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := NewAlbumShelf.MapRequest(&mmpb.NewAlbumShelfRequest{Area: mmpb.AlbumArea_ALBUM_AREA_ZH})
	require.NoError(t, err)
	require.Equal(t, "ZH", params["area"])
	require.Equal(t, "new", params["type"])
	require.Equal(t, int32(50), params["limit"])
	require.Equal(t, false, params["total"])
	require.Equal(t, true, params["rcmd"])
	// year/month 是当前年月（非零正数）。
	require.Greater(t, params["year"], 0)
	require.Greater(t, params["month"], 0)
}

// TestNewAlbumShelf_MapResponse 带 more 标记的列表解析。
func TestNewAlbumShelf_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"albums":[{"id":1,"name":"A"}],"more":true}`
	resp, err := NewAlbumShelf.MapResponse(&mmpb.NewAlbumShelfRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 1)
	require.True(t, resp.HasMore)
}

// TestSubscribedAlbums_CacheNil 结果按调用方而异，不缓存。
func TestSubscribedAlbums_CacheNil(t *testing.T) {
	t.Parallel()
	require.Nil(t, SubscribedAlbums.Cache)
}

// TestSubscribedAlbums_MapResponse 收藏列表解析（带 total）。
func TestSubscribedAlbums_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"albums":[{"id":1,"name":"收藏A"}],"total":5}`
	resp, err := SubscribedAlbums.MapResponse(&mmpb.SubscribedAlbumsRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 1)
	require.Equal(t, int32(5), resp.Total)
}

// TestAlbumDynamic_MapResponse 动态信息解析。
func TestAlbumDynamic_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"subCount":12345,"commentCount":678,"shareCount":90,"isSub":true}`
	resp, err := AlbumDynamic.MapResponse(&mmpb.AlbumDynamicRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.NotNil(t, resp.Info)
	require.Equal(t, int64(12345), resp.Info.SubscribedCount)
	require.Equal(t, int64(678), resp.Info.CommentCount)
	require.Equal(t, int64(90), resp.Info.ShareCount)
	require.True(t, resp.Info.Subscribed)
}

// TestAlbumSongQuality_MapResponse 专辑歌曲音质解析。
func TestAlbumSongQuality_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"songs":[{"id":1,"privileges":[{"level":"standard","maxbr":320000},{"level":"lossless","maxbr":999000}]}]}`
	resp, err := AlbumSongQuality.MapResponse(&mmpb.AlbumSongQualityRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, int64(1), resp.Songs[0].SongId)
	require.Len(t, resp.Songs[0].Qualities, 2)
	require.Equal(t, "standard", resp.Songs[0].Qualities[0].Level)
	require.Equal(t, int64(999000), resp.Songs[0].Qualities[1].Bitrate)
}

// TestSubscribe_MapRequest 收藏入参。
func TestSubscribe_MapRequest(t *testing.T) {
	t.Parallel()

	params, err := Subscribe.MapRequest(&mmpb.SubscribeAlbumRequest{AlbumId: 32311})
	require.NoError(t, err)
	require.Equal(t, "32311", params["id"])
	require.Nil(t, Subscribe.Cache)
}

// TestSubscribe_MapResponse 收藏回填状态为已收藏。
func TestSubscribe_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := Subscribe.MapResponse(&mmpb.SubscribeAlbumRequest{}, json.RawMessage(`{"code":200}`))
	require.NoError(t, err)
	require.True(t, resp.Subscribed)
}

// TestUnsubscribe_MapResponse 取消收藏回填状态。
func TestUnsubscribe_MapResponse(t *testing.T) {
	t.Parallel()

	resp, err := Unsubscribe.MapResponse(&mmpb.UnsubscribeAlbumRequest{}, json.RawMessage(`{"code":200}`))
	require.NoError(t, err)
	require.False(t, resp.Subscribed)
	require.Nil(t, Unsubscribe.Cache)
}
