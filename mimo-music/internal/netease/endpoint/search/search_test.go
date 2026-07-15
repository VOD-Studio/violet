// Package search 的 endpoint MapResponse 测试。
//
// 用网易云 JSON fixture 验证各 type 分支的字段映射正确性。
// 按测试规范：table-driven + t.Run 子测试 + t.Parallel + testify require。
package search

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestMapSearchResponse_Song 单曲搜索结果解析。
func TestMapSearchResponse_Song(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{"songCount":1,"songs":[{"id":347230,"name":"海阔天空","artists":[{"id":111,"name":"Beyond"}],"album":{"id":222,"name":"乐与怒","img1v1Url":"http://a.jpg"},"duration":326000}]}}`

	resp, err := Search.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Songs, 1)
	require.Equal(t, "海阔天空", resp.Songs[0].Name)
	require.Equal(t, int32(1), resp.Total)
	require.Empty(t, resp.Albums, "单曲搜索不应返回专辑")
}

// TestMapSearchResponse_Album 专辑搜索结果解析。
func TestMapSearchResponse_Album(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{"albumCount":1,"albums":[{"id":10,"name":"专辑A","img1v1Url":"http://c.jpg","artist":{"id":20,"name":"歌手B"}}]}}`

	resp, err := Search.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Albums, 1)
	require.Equal(t, "专辑A", resp.Albums[0].Name)
	require.Equal(t, "歌手B", resp.Albums[0].Artist.Name)
	require.Empty(t, resp.Songs, "专辑搜索不应返回单曲")
}

// TestMapSearchResponse_Artist 歌手搜索结果解析。
func TestMapSearchResponse_Artist(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{"artistCount":1,"artists":[{"id":100,"name":"周杰伦","img1v1Url":"http://j.jpg","alias":["Jay"]}]}}`

	resp, err := Search.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Artists, 1)
	require.Equal(t, "周杰伦", resp.Artists[0].Name)
	require.Equal(t, []string{"Jay"}, resp.Artists[0].Alias)
}

// TestMapSearchResponse_Playlist 歌单搜索结果解析。
func TestMapSearchResponse_Playlist(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{"playlistCount":1,"playlists":[{"id":500,"name":"华语经典","coverImgUrl":"http://p.jpg","playCount":99999,"trackCount":50,"creator":{"nickname":"dj"}}]}}`

	resp, err := Search.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Playlists, 1)
	require.Equal(t, "华语经典", resp.Playlists[0].Name)
	require.Equal(t, "dj", resp.Playlists[0].Creator)
}

// TestMapSearchResponse_EmptyResult 空结果不报错。
func TestMapSearchResponse_EmptyResult(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{}}`

	resp, err := Search.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Empty(t, resp.Songs)
	require.Equal(t, int32(0), resp.Total)
}

// TestMapSearchResponse_InvalidJSON 非法 JSON 报错。
func TestMapSearchResponse_InvalidJSON(t *testing.T) {
	t.Parallel()

	_, err := Search.MapResponse(json.RawMessage(`not json`))
	require.Error(t, err)
}

// TestSuggest_MapResponse 搜索建议解析。
func TestSuggest_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"result":{"songs":[{"name":"歌A"}],"albums":[{"name":"专辑B"}],"artists":[{"name":"歌手C"}]}}`

	resp, err := Suggest.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, []string{"歌A"}, resp.Songs)
	require.Equal(t, []string{"专辑B"}, resp.Albums)
	require.Equal(t, []string{"歌手C"}, resp.Artists)
}

// TestHot_MapResponse 热搜简略解析。
func TestHot_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"hotts":[{"searchWord":"热词A","score":999,"iconUrl":"http://i.jpg"}]}`

	resp, err := Hot.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Len(t, resp.Keywords, 1)
	require.Equal(t, "热词A", resp.Keywords[0].SearchWord)
	require.Equal(t, int32(999), resp.Keywords[0].Score)
}

// TestDefaultKeyword_MapResponse 默认搜索词解析。
func TestDefaultKeyword_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"data":{"realkeyword":"默认词"}}`

	resp, err := DefaultKeyword.MapResponse(json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "默认词", resp.Keyword)
}
