// Package openapi 注册 playlist / song / search 模块的 paths。
package openapi

import (
	"github.com/getkin/kin-openapi/openapi3"
)

// registerPlaylistPaths 注册歌单端点。
func registerPlaylistPaths(paths *openapi3.Paths) {
	paths.Set("/api/v1/playlists/{id}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"playlist"},
			Summary: "获取歌单详情（含全量歌曲）",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("歌单 ID")}},
			},
		},
	})
}

// registerSongPaths 注册歌曲端点。
func registerSongPaths(paths *openapi3.Paths) {
	paths.Set("/api/v1/songs/{id}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"song"},
			Summary: "获取歌曲详情",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("歌曲 ID")}},
			},
		},
	})

	paths.Set("/api/v1/songs/{id}/url", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"song"},
			Summary: "获取播放 URL",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("歌曲 ID")}},
				{Value: &openapi3.Parameter{Name: "level", In: openapi3.ParameterInQuery, Required: false,
					Schema: strType("音质"), Description: "standard / exhigh / lossless"}},
			},
		},
	})

	paths.Set("/api/v1/songs/{id}/lyric", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"song"},
			Summary: "获取歌词",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("歌曲 ID")}},
			},
		},
	})
}

// registerSearchPaths 注册搜索端点。
func registerSearchPaths(paths *openapi3.Paths) {
	paths.Set("/api/v1/search", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"search"},
			Summary: "搜索歌曲",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "q", In: openapi3.ParameterInQuery, Required: true,
					Schema: strType("搜索关键词")}},
				{Value: &openapi3.Parameter{Name: "limit", In: openapi3.ParameterInQuery, Required: false,
					Schema: strType("结果数量，默认 10")}},
			},
		},
	})
}

// registerAlbumPaths 注册专辑端点。
func registerAlbumPaths(paths *openapi3.Paths) {
	paths.Set("/api/v1/albums/{id}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"album"},
			Summary: "获取专辑详情（含歌曲列表）",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("专辑 ID")}},
			},
		},
	})
}

// registerArtistPaths 注册歌手端点。
func registerArtistPaths(paths *openapi3.Paths) {
	paths.Set("/api/v1/artists/{id}", &openapi3.PathItem{
		Get: &openapi3.Operation{
			Tags:    []string{"artist"},
			Summary: "获取歌手信息及热门歌曲",
			Parameters: openapi3.Parameters{
				{Value: &openapi3.Parameter{Name: "id", In: openapi3.ParameterInPath, Required: true,
					Schema: strType("歌手 ID")}},
			},
		},
	})
}
