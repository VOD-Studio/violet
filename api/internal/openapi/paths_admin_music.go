package openapi

import "github.com/getkin/kin-openapi/openapi3"

// registerAdminMusicPaths 注册音乐后台歌单管理接口（/admin/music/*）。
// PlaylistDTO/Song 已在 paths_music.go 注册，此处复用。
func registerAdminMusicPaths(t *openapi3.T) {
	registerSchema(t, "ImportPlaylistRequest", openapi3.Schemas{
		"url": reqStr("歌单链接（导入用）"),
	}, "url")

	registerSchema(t, "CreateCustomPlaylistRequest", openapi3.Schemas{
		"title": reqStr("歌单标题"),
	}, "title")

	registerSchema(t, "UpdatePlaylistRequest", openapi3.Schemas{
		"title":     optStr("歌单标题"),
		"is_active": optBool("是否启用"),
	})

	// active 字段为 bool 值类型（required）
	registerSchema(t, "SetPlaylistActiveRequest", openapi3.Schemas{
		"active": optBool("是否启用"),
	}, "active")

	registerSchema(t, "AddSongRequest", openapi3.Schemas{
		"name":   optStr("歌曲名"),
		"artist": optStr("歌手"),
		"url":    optStr("播放 URL"),
		"cover":  optStr("封面 URL"),
	})

	registerSchema(t, "UpdateSongRequest", openapi3.Schemas{
		"name":   optStr("歌曲名"),
		"artist": optStr("歌手"),
		"cover":  optStr("封面 URL"),
		"url":    optStr("播放 URL"),
	})

	registerSchema(t, "UpdatePlayerVersionRequest", openapi3.Schemas{
		"player_version": reqStr("播放器版本"),
	}, "player_version")

	// ---- GET /admin/music/playlists ----
	get(t, "/admin/music/playlists", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "歌单列表",
		Description: "获取所有歌单（非分页）。需管理员权限。",
		Security:    securityAdmin(),
		Responses: responses(
			200, dataArrayResponse("PlaylistDTO", "歌单列表", 200, false),
		),
	})

	post(t, "/admin/music/playlists", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "导入歌单",
		Description: "通过链接导入歌单。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("ImportPlaylistRequest", true, "歌单链接"),
		Responses: responses(
			201, dataResponse("PlaylistDTO", "导入的歌单", 201),
			400, errorResponse("链接无法解析"),
		),
	})

	post(t, "/admin/music/playlists/custom", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "创建自定义歌单",
		Description: "创建空的自定义歌单。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("CreateCustomPlaylistRequest", true, "歌单标题"),
		Responses: responses(
			201, dataResponse("PlaylistDTO", "新建歌单", 201),
		),
	})

	get(t, "/admin/music/playlists/{id}", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "歌单详情",
		Description: "按 ID 获取歌单。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{pathStrParam("id", "歌单 ID（UUID）")},
		Responses: responses(
			200, dataResponse("PlaylistDTO", "歌单详情", 200),
			404, errorResponse("歌单不存在"),
		),
	})

	patch(t, "/admin/music/playlists/{id}", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "更新歌单",
		Description: "更新歌单标题/启用状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdatePlaylistRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("歌单已更新"),
			404, errorResponse("歌单不存在"),
		),
	})

	del(t, "/admin/music/playlists/{id}", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "删除歌单",
		Description: "删除歌单。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("歌单已删除"),
			404, errorResponse("歌单不存在"),
		),
	})

	patch(t, "/admin/music/playlists/{id}/active", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "启用/禁用歌单",
		Description: "切换歌单启用状态。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("SetPlaylistActiveRequest", true, "目标状态"),
		Responses: responses(
			200, messageResponse("状态已更新"),
			404, errorResponse("歌单不存在"),
		),
	})

	post(t, "/admin/music/playlists/{id}/refresh", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "刷新歌单歌曲",
		Description: "重新拉取歌单歌曲（仅导入歌单有效）。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"), csrfHeaderParam(),
		},
		Responses: responses(
			200, dataResponse("PlaylistDTO", "刷新后的歌单", 200),
			404, errorResponse("歌单不存在"),
		),
	})

	post(t, "/admin/music/playlists/{id}/songs", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "添加歌曲到歌单",
		Description: "向歌单添加一首歌曲。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"), csrfHeaderParam(),
		},
		RequestBody: jsonBody("AddSongRequest", true, "歌曲信息"),
		Responses: responses(
			200, messageResponse("歌曲已添加"),
			404, errorResponse("歌单不存在"),
		),
	})

	del(t, "/admin/music/playlists/{id}/songs/{index}", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "移除歌曲",
		Description: "从歌单移除指定位置的歌曲。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"),
			pathIntParam("index", "歌曲序号"),
			csrfHeaderParam(),
		},
		Responses: responses(
			200, messageResponse("歌曲已移除"),
			404, errorResponse("歌单或歌曲不存在"),
		),
	})

	patch(t, "/admin/music/playlists/{id}/songs/{index}", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "更新歌曲",
		Description: "更新歌单中指定位置的歌曲信息。需管理员权限。",
		Security:    securityAdmin(),
		Parameters: openapi3.Parameters{
			pathStrParam("id", "歌单 ID（UUID）"),
			pathIntParam("index", "歌曲序号"),
			csrfHeaderParam(),
		},
		RequestBody: jsonBody("UpdateSongRequest", true, "待更新字段"),
		Responses: responses(
			200, messageResponse("歌曲已更新"),
			404, errorResponse("歌单或歌曲不存在"),
		),
	})

	// ---- PATCH /admin/music/settings ----
	patch(t, "/admin/music/settings", &openapi3.Operation{
		Tags:        []string{"音乐管理"},
		Summary:     "更新播放器设置",
		Description: "更新播放器版本。需管理员权限。",
		Security:    securityAdmin(),
		Parameters:  openapi3.Parameters{csrfHeaderParam()},
		RequestBody: jsonBody("UpdatePlayerVersionRequest", true, "播放器版本"),
		Responses: responses(
			200, messageResponse("播放器版本已更新"),
		),
	})
}
