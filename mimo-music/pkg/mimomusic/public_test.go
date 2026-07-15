package mimomusic

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// mockServer 起一个按 path 返回固定信封响应的测试服务器。
//
// handler 里用 writeEnvelope 写响应，返回的 cleanup 函数关闭服务器。
func mockServer(t *testing.T, handler func(w http.ResponseWriter, r *http.Request)) (*Client, func()) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(handler))
	c := NewClient(srv.URL, WithRetry(0, 0))
	return c, srv.Close
}

// TestGetPlaylist_Success 验证歌单详情解析。
func TestGetPlaylist_Success(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/playlists/100" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, Playlist{
			ID: "100", Title: "夜曲", Creator: "Jay",
			Songs: []Song{{ID: "1", Name: "夜曲", Artist: "周杰伦"}},
		}, "")
	})
	defer cleanup()

	p, err := c.GetPlaylist(context.Background(), "100")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if p.ID != "100" || p.Title != "夜曲" || len(p.Songs) != 1 {
		t.Fatalf("解析错误：%+v", p)
	}
	if p.Songs[0].Artist != "周杰伦" {
		t.Fatalf("歌曲字段错误：%+v", p.Songs[0])
	}
}

// TestGetPlaylist_NotFound 验证错误码路径。
func TestGetPlaylist_NotFound(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 404, 10404, nil, "歌单不存在")
	})
	defer cleanup()

	_, err := c.GetPlaylist(context.Background(), "999")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("应返回 ErrNotFound，得到 %v", err)
	}
}

// TestGetSongDetail_Success 验证歌曲详情解析。
func TestGetSongDetail_Success(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		writeEnvelope(w, 200, 0, SongDetail{ID: "s1", Name: "七里香", Artist: "周杰伦"}, "")
	})
	defer cleanup()

	s, err := c.GetSongDetail(context.Background(), "s1")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if s.Name != "七里香" || s.Artist != "周杰伦" {
		t.Fatalf("解析错误：%+v", s)
	}
}

// TestGetSongURL 验证播放直链，含 level query 参数。
func TestGetSongURL(t *testing.T) {
	t.Run("带 level", func(t *testing.T) {
		c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/v1/songs/s1/url" {
				t.Errorf("路径不符：%q", r.URL.Path)
			}
			if r.URL.Query().Get("level") != "exhigh" {
				t.Errorf("level 参数不符：%q", r.URL.Query().Get("level"))
			}
			writeEnvelope(w, 200, 0, SongURL{URL: "http://example.com/s1.mp3"}, "")
		})
		defer cleanup()

		u, err := c.GetSongURL(context.Background(), "s1", "exhigh")
		if err != nil {
			t.Fatalf("不应返回错误：%v", err)
		}
		if u.URL != "http://example.com/s1.mp3" {
			t.Fatalf("URL 解析错误：%+v", u)
		}
	})

	t.Run("空 level 不带参数", func(t *testing.T) {
		c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Query().Get("level") != "" {
				t.Errorf("空 level 不应带参数，得到 %q", r.URL.Query().Get("level"))
			}
			writeEnvelope(w, 200, 0, SongURL{URL: "http://x"}, "")
		})
		defer cleanup()

		_, err := c.GetSongURL(context.Background(), "s1", "")
		if err != nil {
			t.Fatalf("不应返回错误：%v", err)
		}
	})
}

// TestGetLyric 验证歌词解析。
func TestGetLyric(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/songs/s1/lyric" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, Lyric{Lrc: "[00:01]七里香", Translated: "译"}, "")
	})
	defer cleanup()

	l, err := c.GetLyric(context.Background(), "s1")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if l.Lrc != "[00:01]七里香" || l.Translated != "译" {
		t.Fatalf("解析错误：%+v", l)
	}
}

// TestSearch 验证搜索，含 query 参数。
func TestSearch(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/search" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		if r.URL.Query().Get("q") != "周杰伦" {
			t.Errorf("q 参数不符：%q", r.URL.Query().Get("q"))
		}
		if r.URL.Query().Get("limit") != "5" {
			t.Errorf("limit 参数不符：%q", r.URL.Query().Get("limit"))
		}
		writeEnvelope(w, 200, 0, SearchResult{
			Songs: []Song{{ID: "s1", Name: "七里香"}},
			Total: 1,
		}, "")
	})
	defer cleanup()

	r, err := c.Search(context.Background(), "周杰伦", WithLimit(5))
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if r.Total != 1 || len(r.Songs) != 1 || r.Songs[0].Name != "七里香" {
		t.Fatalf("解析错误：%+v", r)
	}
}

// TestGetAlbum 验证专辑详情解析。
func TestGetAlbum(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/albums/a1" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, Album{
			ID: "a1", Name: "七里香专辑", Artist: "周杰伦", PublishTime: "2004",
			Songs: []Song{{ID: "s1"}},
		}, "")
	})
	defer cleanup()

	a, err := c.GetAlbum(context.Background(), "a1")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if a.Name != "七里香专辑" || a.PublishTime != "2004" || len(a.Songs) != 1 {
		t.Fatalf("解析错误：%+v", a)
	}
}

// TestGetArtist 验证歌手信息解析。
func TestGetArtist(t *testing.T) {
	c, cleanup := mockServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/artists/ar1" {
			t.Errorf("路径不符：%q", r.URL.Path)
		}
		writeEnvelope(w, 200, 0, Artist{
			ID: "ar1", Name: "周杰伦", Description: "歌手",
			Songs: []Song{{ID: "s1"}},
		}, "")
	})
	defer cleanup()

	a, err := c.GetArtist(context.Background(), "ar1")
	if err != nil {
		t.Fatalf("不应返回错误：%v", err)
	}
	if a.Name != "周杰伦" || a.Description != "歌手" || len(a.Songs) != 1 {
		t.Fatalf("解析错误：%+v", a)
	}
}

// TestPublicMethods_JSONShape 验证 SDK DTO 的 JSON tag 与
// mimo-music handler 返回结构对齐（防 tag 漂移）。
func TestPublicMethods_JSONShape(t *testing.T) {
	t.Run("Album publish_time tag", func(t *testing.T) {
		raw := `{"id":"a","name":"n","publish_time":"2020"}`
		var a Album
		if err := json.Unmarshal([]byte(raw), &a); err != nil {
			t.Fatal(err)
		}
		if a.PublishTime != "2020" {
			t.Fatalf("publish_time tag 漂移：%+v", a)
		}
	})
}
