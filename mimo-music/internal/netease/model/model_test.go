// Package model 的测试。用网易云 JSON fixture 验证 map 函数。
package model

import (
	"encoding/json"
	"testing"
)

// TestMapSong 验证歌曲映射：缩写字段 → proto 字段。
func TestMapSong(t *testing.T) {
	s := rawSong{
		ID:   347230,
		Name: "海阔天空",
		Ar: []rawArtist{
			{ID: 111, Name: "Beyond"},
		},
		Al:  rawAlbum{ID: 222, Name: "乐与怒", Pic: "http://example.com/cover.jpg"},
		Dt:  326000,
		Fee: 8,
	}

	got := MapSong(s)
	if got.Id != 347230 || got.Name != "海阔天空" {
		t.Errorf("Id/Name = %d/%s", got.Id, got.Name)
	}
	if got.DurationMs != 326000 {
		t.Errorf("DurationMs = %d, 期望 326000", got.DurationMs)
	}
	if got.Fee != 8 {
		t.Errorf("Fee = %d, 期望 8", got.Fee)
	}
	if len(got.Artists) != 1 || got.Artists[0].Name != "Beyond" {
		t.Errorf("Artists = %v", got.Artists)
	}
	if got.Album == nil || got.Album.Name != "乐与怒" || got.Album.PicUrl != "http://example.com/cover.jpg" {
		t.Errorf("Album = %v", got.Album)
	}
}

// TestMapSong_EmptyArtists 空歌手列表不 panic。
func TestMapSong_EmptyArtists(t *testing.T) {
	s := rawSong{ID: 1, Name: "test"}
	got := MapSong(s)
	if len(got.Artists) != 0 {
		t.Errorf("空歌手应返回空切片，得到 %d", len(got.Artists))
	}
}

// TestMapArtists firstNonEmpty 取 picUrl 优先 img1v1Url。
func TestMapArtist_PicUrl(t *testing.T) {
	a := rawArtist{ID: 1, Name: "test", Pic: "http://pic.jpg"}
	got := MapArtist(a)
	if got.PicUrl != "http://pic.jpg" {
		t.Errorf("PicUrl = %s, 期望 http://pic.jpg", got.PicUrl)
	}

	// Pic 为空时回退 Img。
	a2 := rawArtist{ID: 2, Name: "test2", Img: "http://img.jpg"}
	got2 := MapArtist(a2)
	if got2.PicUrl != "http://img.jpg" {
		t.Errorf("回退 Img 应得 http://img.jpg，得到 %s", got2.PicUrl)
	}
}

// TestMapUser userId 和 id 两种字段名。
func TestMapUser(t *testing.T) {
	// userId 字段。
	u1 := rawUser{UserID: 123, Nickname: "alice", AvatarURL: "http://a.jpg"}
	got := MapUser(u1)
	if got.Id != 123 || got.Nickname != "alice" || got.AvatarUrl != "http://a.jpg" {
		t.Errorf("userId 映射: %v", got)
	}

	// userId 为空时回退 id 字段。
	u2 := rawUser{ProfileUserID: 456, Nickname: "bob"}
	got2 := MapUser(u2)
	if got2.Id != 456 {
		t.Errorf("id 回退: Id = %d, 期望 456", got2.Id)
	}
}

// TestDecodeSongDetail 从 JSON 解析歌曲详情。
func TestDecodeSongDetail(t *testing.T) {
	fixture := `{"code":200,"songs":[{"id":1,"name":"test","ar":[{"id":11,"name":"artist"}],"al":{"id":22,"name":"album","picUrl":"http://c.jpg"},"dt":180000,"fee":0}]}`

	songs, err := DecodeSongDetail(json.RawMessage(fixture))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if len(songs) != 1 {
		t.Fatalf("应返回 1 首歌，得到 %d", len(songs))
	}
	if songs[0].Name != "test" || songs[0].Album.Name != "album" {
		t.Errorf("歌曲字段错误: %v", songs[0])
	}
}

// TestMapPlaylist 从 JSON 解析歌单详情。
func TestMapPlaylist(t *testing.T) {
	fixture := `{"code":200,"playlist":{"id":100,"name":"我的歌单","coverImgUrl":"http://cover.jpg","trackCount":3,"creator":{"userId":200,"nickname":"me"},"tracks":[{"id":1,"name":"s1","ar":[],"al":{"id":2,"name":"a1"},"dt":100000,"fee":0}]}}`

	got, err := MapPlaylist(json.RawMessage(fixture))
	if err != nil {
		t.Fatalf("解析失败: %v", err)
	}
	if got.Id != 100 || got.Name != "我的歌单" || got.TrackCount != 3 {
		t.Errorf("歌单字段错误: %+v", got)
	}
	if got.Creator == nil || got.Creator.Id != 200 || got.Creator.Nickname != "me" {
		t.Errorf("创建者字段错误: %v", got.Creator)
	}
	if len(got.Songs) != 1 || got.Songs[0].Name != "s1" {
		t.Errorf("歌曲列表错误: %v", got.Songs)
	}
}

// TestMapAlbum publishTime 格式化。
func TestMapAlbum(t *testing.T) {
	a := rawAlbum{ID: 1, Name: "test", PublishTime: 725846400000} // 1993-01-01
	got := MapAlbum(a)
	if got.PublishTime != "1993-01-01" {
		t.Errorf("PublishTime = %s, 期望 1993-01-01", got.PublishTime)
	}
}
