package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerMusicPaths 注册音乐公开接口。
//
// 注意：EmbedInfo/SongMeta/PlaylistMeta（domain/music）无 json tag，
// 序列化字段名为 Go 默认大写（PascalCase），照实登记。Song 有 json tag（小写）。
func registerMusicPaths(t *openapi3.T) {
	// ---- schema ----
	// Song：歌曲（有 json tag）
	registerSchema(t, "Song", openapi3.Schemas{
		"name":   reqStr("歌曲名"),
		"artist": reqStr("歌手"),
		"url":    optStr("播放 URL"),
		"cover":  optStr("封面 URL"),
	})

	// EmbedInfo：嵌入信息（无 json tag，PascalCase）
	registerSchema(t, "MusicEmbedInfo", openapi3.Schemas{
		"Platform": strEnum("平台", "netease", "tencent"),
		"SongID":   reqStr("歌曲 ID"),
		"EmbedURL": reqStr("嵌入播放器 URL"),
	})

	// SongMeta：歌曲元数据（无 json tag，PascalCase）
	registerSchema(t, "MusicSongMeta", openapi3.Schemas{
		"Cover":  optStr("封面 URL"),
		"Lyrics": optStr("歌词文本"),
	})

	// PlaylistMeta：歌单元数据（无 json tag，PascalCase）
	registerSchema(t, "MusicPlaylistMeta", openapi3.Schemas{
		"Title":      optStr("歌单标题"),
		"Cover":      optStr("歌单封面"),
		"Creator":    optStr("创建者"),
		"Platform":   strEnum("平台", "netease", "tencent"),
		"PlaylistID": optStr("歌单 ID"),
		"Songs":      refArray("歌曲列表", "Song"),
	})

	// PlaylistDTO：歌单（有 json tag，小写）
	registerSchema(t, "PlaylistDTO", openapi3.Schemas{
		"id":          reqStr("歌单 ID（UUID）"),
		"title":       reqStr("歌单标题"),
		"cover":       optStr("歌单封面"),
		"creator":     optStr("创建者"),
		"platform":    optStr("平台"),
		"playlist_id": optStr("外部歌单 ID"),
		"song_count":  optInt("歌曲数量"),
		"songs":       refArray("歌曲列表", "Song"),
		"is_active":   optBool("是否启用"),
		"created_at":  optStr("创建时间（恒为空，后端未填充）"),
		"updated_at":  optStr("更新时间（恒为空，后端未填充）"),
	})

	// MusicSettingsDTO：播放器设置
	registerSchema(t, "MusicSettingsDTO", openapi3.Schemas{
		"player_version": optStr("播放器版本"),
	})

	// ---- GET /music/embed ----
	get(t, "/music/embed", &openapi3.Operation{
		Tags:       []string{"音乐"},
		Summary:    "解析音乐链接返回嵌入信息",
		Parameters: openapi3.Parameters{queryStrParam("url", "音乐链接（必填）")},
		Responses: responses(
			200, dataResponse("MusicEmbedInfo", "嵌入播放器信息", 200),
			400, errorResponse("链接无法解析"),
		),
	})

	// ---- GET /music/playlist ----
	get(t, "/music/playlist", &openapi3.Operation{
		Tags:       []string{"音乐"},
		Summary:    "解析歌单链接返回歌单信息",
		Parameters: openapi3.Parameters{queryStrParam("url", "歌单链接（必填）")},
		Responses: responses(
			200, dataResponse("MusicPlaylistMeta", "歌单信息", 200),
			400, errorResponse("链接无法解析"),
		),
	})

	// ---- GET /music/song ----
	get(t, "/music/song", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "获取歌曲详情",
		Parameters: openapi3.Parameters{
			queryStrParam("id", "歌曲 ID（必填）"),
			queryStrParam("platform", "平台（如 netease/tencent）"),
		},
		Responses: responses(
			200, dataResponse("Song", "歌曲详情", 200),
			400, errorResponse("缺少 id"),
		),
	})

	// ---- GET /music/search ----
	get(t, "/music/search", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "搜索歌曲",
		Parameters: openapi3.Parameters{
			queryStrParam("keyword", "关键词（必填，别名 kw）"),
			&openapi3.ParameterRef{Value: &openapi3.Parameter{
				Name: "limit", In: openapi3.ParameterInQuery,
				Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
					Type: &openapi3.Types{openapi3.TypeInteger}, Default: 10,
				}},
				Description: "返回数量（默认 10）",
			}},
		},
		Responses: responses(
			200, dataArrayResponse("Song", "搜索结果", 200, false),
			400, errorResponse("缺少 keyword"),
		),
	})

	// ---- GET /music/lyrics ----
	get(t, "/music/lyrics", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "获取歌词",
		Parameters: openapi3.Parameters{
			queryStrParam("id", "歌曲 ID（必填）"),
			queryStrParam("platform", "平台"),
		},
		Responses: responses(
			200, &openapi3.ResponseRef{Value: &openapi3.Response{
				Description: strPtr("歌词文本"),
				Content: openapi3.Content{
					"application/json": {Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{
						Type: &openapi3.Types{openapi3.TypeObject},
						Properties: openapi3.Schemas{
							"data": {Value: &openapi3.Schema{
								Type: &openapi3.Types{openapi3.TypeString}, Description: "LRC 歌词文本",
							}},
							"meta": {Ref: "#/components/schemas/" + compMeta},
						},
					}}},
				},
			}},
			400, errorResponse("缺少 id"),
		),
	})

	// ---- GET /music/meta ----
	get(t, "/music/meta", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "获取歌曲元数据（封面+歌词）",
		Parameters: openapi3.Parameters{
			queryStrParam("id", "歌曲 ID（必填）"),
			queryStrParam("platform", "平台"),
		},
		Responses: responses(
			200, dataResponse("MusicSongMeta", "封面与歌词", 200),
			400, errorResponse("缺少 id"),
		),
	})

	// ---- GET /music/playlists/active ----
	get(t, "/music/playlists/active", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "获取所有启用歌单",
		Responses: responses(
			200, dataArrayResponse("PlaylistDTO", "启用歌单列表", 200, false),
		),
	})

	// ---- GET /music/settings ----
	get(t, "/music/settings", &openapi3.Operation{
		Tags:    []string{"音乐"},
		Summary: "获取播放器设置",
		Responses: responses(
			200, dataResponse("MusicSettingsDTO", "播放器设置", 200),
		),
	})
}
