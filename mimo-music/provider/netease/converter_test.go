// Package netease 实现网易云音乐平台的 Provider。
package netease

import (
	"testing"

	"github.com/VOD-Studio/mimo-music/provider"
)

func TestJoinArtists(t *testing.T) {
	tests := []struct {
		name     string
		artists  []struct {
			Name string `json:"name"`
		}
		want string
	}{
		{"单个歌手", []struct{ Name string `json:"name"` }{{Name: "周杰伦"}}, "周杰伦"},
		{"多个歌手", []struct{ Name string `json:"name"` }{{Name: "周杰伦"}, {Name: "费玉清"}}, "周杰伦/费玉清"},
		{"空数组", []struct{ Name string `json:"name"` }{}, ""},
		{"含空名", []struct{ Name string `json:"name"` }{{Name: "周杰伦"}, {Name: ""}}, "周杰伦"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := joinArtists(tt.artists); got != tt.want {
				t.Errorf("joinArtists() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestToSongResult(t *testing.T) {
	s := neteaseSongDetailSongs{
		ID:   347230,
		Name: "孤勇者",
		Ar: []struct {
			Name string `json:"name"`
		}{{Name: "陈奕迅"}},
		Al: struct {
			Name   string `json:"name"`
			PicUrl string `json:"picUrl"`
		}{Name: "孤勇者", PicUrl: "https://p1.music.126.net/cover.jpg"},
		Dt: 263000,
	}

	got := toSongResult(s)

	if got.ID != "347230" {
		t.Errorf("ID = %q, want 347230", got.ID)
	}
	if got.Name != "孤勇者" {
		t.Errorf("Name = %q, want 孤勇者", got.Name)
	}
	if got.Artist != "陈奕迅" {
		t.Errorf("Artist = %q, want 陈奕迅", got.Artist)
	}
	if got.Album != "孤勇者" {
		t.Errorf("Album = %q, want 孤勇者", got.Album)
	}
	if got.Cover != "https://p1.music.126.net/cover.jpg" {
		t.Errorf("Cover mismatch")
	}
	if got.Duration != 263000 {
		t.Errorf("Duration = %d, want 263000", got.Duration)
	}
}

func TestToModelSong(t *testing.T) {
	sr := provider.SongResult{
		ID:       "123",
		Name:     "test",
		Artist:   "artist",
		Album:    "album",
		Cover:    "cover.jpg",
		Duration: 100000,
	}
	got := toModelSong(sr)

	if got.ID != sr.ID || got.Name != sr.Name || got.Artist != sr.Artist {
		t.Error("conversion lost data")
	}
}
