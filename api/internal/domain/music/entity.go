// Package music 定义音乐歌单聚合的领域模型。
//
// 歌曲以 JSONB 内联存储在 playlists.songs 字段（非规范化三表），
// 保持与现有数据结构一致。
package music

import "blog-api/internal/domain/shared"

// Song 歌曲信息（JSONB 内联结构）
type Song struct {
	Name   string `json:"name"`
	Artist string `json:"artist"`
	URL    string `json:"url"`
	Cover  string `json:"cover"`
}

// Playlist 歌单聚合根
type Playlist struct {
	shared.AggregateRoot
	id         shared.ID
	title      string
	cover      string
	creator    string
	platform   string
	playlistID string // 第三方歌单 ID
	songCount  int
	songs      []Song
	isActive   bool
}

func NewPlaylist(id shared.ID, title, platform, playlistID string) (*Playlist, error) {
	if title == "" {
		return nil, shared.BadRequest("歌单名称不能为空")
	}
	return &Playlist{id: id, title: title, platform: platform, playlistID: playlistID, songs: []Song{}}, nil
}

func ReconstructPlaylist(id shared.ID, title, cover, creator, platform, playlistID string, songCount int, songs []Song, isActive bool) *Playlist {
	if songs == nil {
		songs = []Song{}
	}
	return &Playlist{id: id, title: title, cover: cover, creator: creator, platform: platform,
		playlistID: playlistID, songCount: songCount, songs: songs, isActive: isActive}
}

func (p *Playlist) SetActive(active bool) { p.isActive = active }
func (p *Playlist) SetSongs(songs []Song) {
	if songs == nil {
		songs = []Song{}
	}
	p.songs = songs
	p.songCount = len(songs)
}
func (p *Playlist) ID() shared.ID      { return p.id }
func (p *Playlist) Title() string      { return p.title }
func (p *Playlist) Cover() string      { return p.cover }
func (p *Playlist) Creator() string    { return p.creator }
func (p *Playlist) Platform() string   { return p.platform }
func (p *Playlist) PlaylistID() string { return p.playlistID }
func (p *Playlist) SongCount() int     { return p.songCount }
func (p *Playlist) Songs() []Song      { return p.songs }
func (p *Playlist) IsActive() bool     { return p.isActive }
