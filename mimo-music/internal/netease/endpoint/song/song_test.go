// Package song 的 endpoint MapRequest/MapResponse 测试。
package song

import (
	"encoding/json"
	"testing"

	mmpb "github.com/VOD-Studio/mimo-music/gen/go/netease/music/v1"
	"github.com/stretchr/testify/require"
)

// TestDetail_MapResponse 歌曲详情解析。
func TestDetail_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"songs":[{"id":347230,"name":"海阔天空","ar":[{"id":111,"name":"Beyond"}],"al":{"id":222,"name":"乐与怒","picUrl":"http://c.jpg"},"dt":326000,"fee":0}]}`

	resp, err := Detail.MapResponse(&mmpb.GetSongDetailRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, int64(347230), resp.Song.Id)
	require.Equal(t, "海阔天空", resp.Song.Name)
	require.Len(t, resp.Song.Artists, 1)
	require.Equal(t, "Beyond", resp.Song.Artists[0].Name)
	require.Equal(t, "乐与怒", resp.Song.Album.Name)
	require.Equal(t, int64(326000), resp.Song.DurationMs)
}

// TestDetail_MapResponse_Empty 歌曲不存在报错。
func TestDetail_MapResponse_Empty(t *testing.T) {
	t.Parallel()

	_, err := Detail.MapResponse(&mmpb.GetSongDetailRequest{}, json.RawMessage(`{"code":200,"songs":[]}`))
	require.Error(t, err)
}

// TestURL_MapResponse 播放URL解析。
func TestURL_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"data":[{"id":347230,"url":"http://m.mp3","br":320000,"size":5000000,"type":"mp3"}]}`

	resp, err := URL.MapResponse(&mmpb.GetSongURLRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Equal(t, "http://m.mp3", resp.Url.Url)
	require.Equal(t, int64(320000), resp.Url.Bitrate)
	require.Equal(t, "mp3", resp.Url.Format)
}

// TestURL_MapResponse_VIP VIP歌曲URL为空。
func TestURL_MapResponse_VIP(t *testing.T) {
	t.Parallel()

	_, err := URL.MapResponse(&mmpb.GetSongURLRequest{}, json.RawMessage(`{"code":200,"data":[]}`))
	require.Error(t, err)
}

// TestLyric_MapResponse 歌词解析。
func TestLyric_MapResponse(t *testing.T) {
	t.Parallel()

	fixture := `{"code":200,"lrc":{"version":1,"lyric":"[00:01]词"},"tlyric":{"version":1,"lyric":"[00:01]Translation"},"romalrc":{"version":1,"lyric":"[00:01]ci"}}`

	resp, err := Lyric.MapResponse(&mmpb.GetLyricRequest{}, json.RawMessage(fixture))
	require.NoError(t, err)
	require.Contains(t, resp.Lyric.Lrc, "词")
	require.Contains(t, resp.Lyric.Translated, "Translation")
	require.Contains(t, resp.Lyric.Romanized, "ci")
}

// TestURL_MapRequest level enum 转网易云字符串。
func TestURL_MapRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		level mmpb.SongLevel
		want  string
	}{
		{"标准", mmpb.SongLevel_SONG_LEVEL_STANDARD, "standard"},
		{"极高", mmpb.SongLevel_SONG_LEVEL_EXHIGH, "exhigh"},
		{"无损", mmpb.SongLevel_SONG_LEVEL_LOSSLESS, "lossless"},
		{"HiRes", mmpb.SongLevel_SONG_LEVEL_HRES, "hires"},
		{"默认回退", mmpb.SongLevel_SONG_LEVEL_UNSPECIFIED, "standard"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			params, err := URL.MapRequest(&mmpb.GetSongURLRequest{SongId: 1, Level: tt.level})
			require.NoError(t, err)
			require.Equal(t, tt.want, params["level"])
		})
	}
}
