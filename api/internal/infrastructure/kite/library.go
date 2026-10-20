package kite

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"blog-api/internal/domain/music"
	"blog-api/internal/domain/shared"
)

type songWire struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Artists []music.Artist `json:"artists"`
	Album   struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		PicURL string `json:"picUrl"`
	} `json:"album"`
	DurationMS int64 `json:"durationMs,string"`
	Fee        int   `json:"fee"`
}

func (s songWire) song() music.Song {
	artists := s.Artists
	if artists == nil {
		artists = []music.Artist{}
	}
	return music.Song{ID: s.ID, Name: s.Name, Artists: artists, Album: music.Album{ID: s.Album.ID, Name: s.Album.Name, CoverURL: publicURL(s.Album.PicURL)}, DurationMS: s.DurationMS, Fee: s.Fee}
}

type playlistWire struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	CoverURL   string `json:"coverUrl"`
	TrackCount int    `json:"trackCount"`
	Creator    struct {
		Nickname string `json:"nickname"`
	} `json:"creator"`
}

func (p playlistWire) playlist() music.Playlist {
	return music.Playlist{ID: p.ID, Name: p.Name, CoverURL: publicURL(p.CoverURL), TrackCount: p.TrackCount, Creator: p.Creator.Nickname}
}
func paging(q shared.PageQuery) url.Values {
	return url.Values{"limit": {strconv.Itoa(q.Limit)}, "offset": {strconv.Itoa(q.Offset())}}
}
func (c *Client) UserPlaylists(ctx context.Context, id, cookie string, q shared.PageQuery) (shared.PageResult[music.Playlist], error) {
	var response struct {
		Playlists []playlistWire `json:"playlists"`
		Total     int64          `json:"total"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/users/"+id+"/playlists", cookie, paging(q), &response)
	items := make([]music.Playlist, len(response.Playlists))
	for i, p := range response.Playlists {
		items[i] = p.playlist()
	}
	return shared.NewPageResult(q, items, response.Total), err
}
func (c *Client) Playlist(ctx context.Context, id string) (music.Playlist, error) {
	var response struct {
		Playlist playlistWire `json:"playlist"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/playlists/"+id, "", nil, &response)
	if err == nil && response.Playlist.ID != id {
		err = failure("UPSTREAM_ERROR", "歌单不存在或无法匿名访问")
	}
	return response.Playlist.playlist(), err
}
func (c *Client) Tracks(ctx context.Context, id, cookie string, q shared.PageQuery) (shared.PageResult[music.Song], error) {
	var response struct {
		Songs []songWire `json:"songs"`
		Total int64      `json:"total"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/playlists/"+id+"/tracks", cookie, paging(q), &response)
	items := make([]music.Song, len(response.Songs))
	for i, s := range response.Songs {
		items[i] = s.song()
	}
	return shared.NewPageResult(q, items, response.Total), err
}
func (c *Client) SearchSongs(ctx context.Context, keyword string, q shared.PageQuery) (shared.PageResult[music.Song], error) {
	var response struct {
		Songs []songWire `json:"songs"`
		Total int64      `json:"total"`
	}
	query := paging(q)
	query.Set("keyword", keyword)
	query.Set("type", "SEARCH_TYPE_SONG")
	err := c.request(ctx, http.MethodGet, "/api/v1/search", "", query, &response)
	items := make([]music.Song, len(response.Songs))
	for i, s := range response.Songs {
		items[i] = s.song()
	}
	return shared.NewPageResult(q, items, response.Total), err
}
func (c *Client) SearchPlaylists(ctx context.Context, keyword string, q shared.PageQuery) (shared.PageResult[music.Playlist], error) {
	var response struct {
		Playlists []struct {
			ID         string `json:"id"`
			Name       string `json:"name"`
			CoverURL   string `json:"coverUrl"`
			TrackCount int    `json:"trackCount"`
			Creator    string `json:"creator"`
		} `json:"playlists"`
		Total int64 `json:"total"`
	}
	query := paging(q)
	query.Set("keyword", keyword)
	query.Set("type", "SEARCH_TYPE_PLAYLIST")
	err := c.request(ctx, http.MethodGet, "/api/v1/search", "", query, &response)
	items := make([]music.Playlist, len(response.Playlists))
	for i, p := range response.Playlists {
		items[i] = music.Playlist{ID: p.ID, Name: p.Name, CoverURL: publicURL(p.CoverURL), TrackCount: p.TrackCount, Creator: p.Creator}
	}
	return shared.NewPageResult(q, items, response.Total), err
}
func (c *Client) Song(ctx context.Context, id string) (music.Song, error) {
	var response struct {
		Song songWire `json:"song"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/songs/"+id, "", nil, &response)
	if err == nil && response.Song.ID != id {
		err = failure("UPSTREAM_ERROR", "歌曲不存在或无法匿名访问")
	}
	return response.Song.song(), err
}
func (c *Client) SongURL(ctx context.Context, id, level string) (music.SongURL, error) {
	var response struct {
		URL struct {
			ID      string `json:"id"`
			URL     string `json:"url"`
			Format  string `json:"format"`
			Bitrate int64  `json:"bitrate,string"`
			Size    int64  `json:"size,string"`
		} `json:"url"`
	}
	// Kite 的枚举使用 HRES，公开接口沿用 hires。
	if level == "hires" {
		level = "hres"
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/songs/"+id+"/url", "", url.Values{"level": {"SONG_LEVEL_" + strings.ToUpper(level)}}, &response)
	result := music.SongURL{ID: id, Format: response.URL.Format, Bitrate: response.URL.Bitrate, Size: response.URL.Size}
	if value := publicURL(response.URL.URL); value != "" {
		result.URL = &value
		result.Playable = true
	}
	return result, err
}
func (c *Client) Lyric(ctx context.Context, id string) (music.Lyric, error) {
	var response struct {
		Lyric music.Lyric `json:"lyric"`
	}
	err := c.request(ctx, http.MethodGet, "/api/v1/songs/"+id+"/lyric", "", nil, &response)
	return response.Lyric, err
}
