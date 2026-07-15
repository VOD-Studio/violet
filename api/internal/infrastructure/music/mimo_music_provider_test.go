package music

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/VOD-Studio/mimo-music/pkg/mimomusic"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainmusic "blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

// writeEnvelope 写一个 mimo-music 风格的统一信封响应 {code, data, message}。
func writeEnvelope(w http.ResponseWriter, code int, data any, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	var d json.RawMessage
	if data != nil {
		d, _ = json.Marshal(data)
	} else {
		d = json.RawMessage("null")
	}
	_ = json.NewEncoder(w).Encode(struct {
		Code    int             `json:"code"`
		Data    json.RawMessage `json:"data"`
		Message string          `json:"message"`
	}{Code: code, Data: d, Message: message})
}

// newTestProvider 启动一个 mock mimo-music 服务并返回连接它的 provider。
//
// handler 负责按路径返回不同的 mock 响应；测试结束后自动关闭服务。
func newTestProvider(t *testing.T, handler http.HandlerFunc) *MimoMusicProvider {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewMimoMusicProvider(srv.URL)
}

// ============================================================
// ParseEmbedURL
// ============================================================

func TestParseEmbedURL_NeteaseSong(t *testing.T) {
	p := NewMimoMusicProvider("http://localhost:3721")
	info, err := p.ParseEmbedURL("https://music.163.com/song/123456")
	require.NoError(t, err)
	assert.Equal(t, "netease", info.Platform)
	assert.Equal(t, "123456", info.SongID)
	assert.Contains(t, info.EmbedURL, "id=123456")
}

func TestParseEmbedURL_UnsupportedURL(t *testing.T) {
	p := NewMimoMusicProvider("http://localhost:3721")
	_, err := p.ParseEmbedURL("https://y.qq.com/n/ryqq/songDetail/abc")
	require.ErrorIs(t, err, domainmusic.ErrUnsupportedMusicURL)
}

// ============================================================
// Search
// ============================================================

func TestSearch_Success(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/search", r.URL.Path)
		assert.Equal(t, "周杰伦", r.URL.Query().Get("q"))
		assert.Equal(t, "5", r.URL.Query().Get("limit"))
		writeEnvelope(w, 0, mimomusic.SearchResult{
			Songs: []mimomusic.Song{
				{ID: "1", Name: "晴天", Artist: "周杰伦", Cover: "http://cover/1.jpg"},
			},
			Total: 1,
		}, "")
	})
	songs, err := p.Search("周杰伦", 5)
	require.NoError(t, err)
	require.Len(t, songs, 1)
	assert.Equal(t, "晴天", songs[0].Name)
	assert.Equal(t, "周杰伦", songs[0].Artist)
	assert.Equal(t, "http://cover/1.jpg", songs[0].Cover)
}

func TestSearch_UpstreamError(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 10502, nil, "网易云不可用")
	})
	_, err := p.Search("test", 10)
	require.Error(t, err)
	// ErrUpstreamUnavailable 映射到 Internal
	var de *shared.DomainError
	require.ErrorAs(t, err, &de)
	assert.Equal(t, shared.CodeInternal, de.Code)
}

// ============================================================
// FetchLyrics
// ============================================================

func TestFetchLyrics_Success(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/songs/123/lyric", r.URL.Path)
		writeEnvelope(w, 0, mimomusic.Lyric{Lrc: "[00:01]测试歌词\n"}, "")
	})
	lrc, err := p.FetchLyrics("netease", "123")
	require.NoError(t, err)
	assert.Equal(t, "[00:01]测试歌词", lrc) // TrimSpace 去掉尾换行
}

// ============================================================
// FetchSongDetail
// ============================================================

func TestFetchSongDetail_Success(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/songs/456", r.URL.Path)
		writeEnvelope(w, 0, mimomusic.SongDetail{
			ID: "456", Name: "七里香", Artist: "周杰伦", Cover: "http://cover/456.jpg",
		}, "")
	})
	song, err := p.FetchSongDetail("netease", "456")
	require.NoError(t, err)
	assert.Equal(t, "七里香", song.Name)
	assert.Equal(t, "http://cover/456.jpg", song.Cover)
}

func TestFetchSongDetail_NotFound(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 10404, nil, "歌曲不存在")
	})
	_, err := p.FetchSongDetail("netease", "999")
	require.Error(t, err)
	var de *shared.DomainError
	require.ErrorAs(t, err, &de)
	assert.Equal(t, shared.CodeNotFound, de.Code)
}

// ============================================================
// FetchSongMeta
// ============================================================

func TestFetchSongMeta_Success(t *testing.T) {
	calls := 0
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path == "/api/v1/songs/789" {
			writeEnvelope(w, 0, mimomusic.SongDetail{Cover: "http://cover/789.jpg"}, "")
		} else if r.URL.Path == "/api/v1/songs/789/lyric" {
			writeEnvelope(w, 0, mimomusic.Lyric{Lrc: "[00:00]歌词"}, "")
		}
	})
	meta, err := p.FetchSongMeta("netease", "789")
	require.NoError(t, err)
	assert.Equal(t, "http://cover/789.jpg", meta.Cover)
	assert.Equal(t, "[00:00]歌词", meta.Lyrics)
	assert.Equal(t, 2, calls) // 详情 + 歌词各调一次
}

// ============================================================
// FetchPlaylist
// ============================================================

func TestFetchPlaylist_Success(t *testing.T) {
	p := newTestProvider(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/v1/playlists/100", r.URL.Path)
		writeEnvelope(w, 0, mimomusic.Playlist{
			ID: "100", Title: "我的歌单", Cover: "http://cover/pl.jpg", Creator: "博主",
			Songs: []mimomusic.Song{
				{ID: "1", Name: "歌A", Artist: "歌手A"},
				{ID: "2", Name: "歌B", Artist: "歌手B"},
			},
		}, "")
	})
	meta, err := p.FetchPlaylist("https://music.163.com/playlist/100")
	require.NoError(t, err)
	assert.Equal(t, "我的歌单", meta.Title)
	assert.Equal(t, "netease", meta.Platform)
	assert.Equal(t, "100", meta.PlaylistID)
	require.Len(t, meta.Songs, 2)
	assert.Equal(t, "歌A", meta.Songs[0].Name)
}

func TestFetchPlaylist_UnsupportedURL(t *testing.T) {
	p := NewMimoMusicProvider("http://localhost:3721")
	_, err := p.FetchPlaylist("https://example.com/random")
	require.ErrorIs(t, err, domainmusic.ErrUnsupportedMusicURL)
}

// ============================================================
// URL 解析
// ============================================================

func TestParseNeteaseSongID(t *testing.T) {
	cases := []struct {
		url  string
		want string
	}{
		{"https://music.163.com/song/123456", "123456"},
		{"https://music.163.com/#/song?id=789", "789"},
		{"https://music.163.com/album/999?id=123", "123"},
		{"https://y.qq.com/song/abc", ""},
		{"", ""},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, parseNeteaseSongID(c.url), "url=%q", c.url)
	}
}

func TestParseNeteasePlaylistID(t *testing.T) {
	cases := []struct {
		url  string
		want string
	}{
		{"https://music.163.com/playlist/100", "100"},
		{"https://music.163.com/#/playlist?id=200", "200"},
		{"https://music.163.com/song/123", ""},     // 单曲链接不是歌单
		{"https://y.qq.com/playlist/abc", ""},
		{"", ""},
	}
	for _, c := range cases {
		assert.Equal(t, c.want, parseNeteasePlaylistID(c.url), "url=%q", c.url)
	}
}

// ============================================================
// mapSDKErr 错误映射
// ============================================================

func TestMapSDKErr(t *testing.T) {
	t.Run("NotFound映射", func(t *testing.T) {
		err := mapSDKErr(mimomusic.ErrNotFound, "test")
		var de *shared.DomainError
		require.ErrorAs(t, err, &de)
		assert.Equal(t, shared.CodeNotFound, de.Code)
	})
	t.Run("InvalidRequest映射", func(t *testing.T) {
		err := mapSDKErr(mimomusic.ErrInvalidRequest, "test")
		var de *shared.DomainError
		require.ErrorAs(t, err, &de)
		assert.Equal(t, shared.CodeBadRequest, de.Code)
	})
	t.Run("其他错误映射Internal", func(t *testing.T) {
		err := mapSDKErr(mimomusic.ErrUpstreamUnavailable, "test")
		var de *shared.DomainError
		require.ErrorAs(t, err, &de)
		assert.Equal(t, shared.CodeInternal, de.Code)
	})
	// 确保包裹后的错误仍可用 errors.Is 识别底层错误
	t.Run("errors.Is穿透", func(t *testing.T) {
		err := mapSDKErr(mimomusic.ErrNotFound, "test")
		assert.True(t, errors.Is(err, mimomusic.ErrNotFound))
	})
}
