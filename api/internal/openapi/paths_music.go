package openapi

import (
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

func registerMusicPaths(t *openapi3.T) {
	registerSchema(t, "MusicArtist", openapi3.Schemas{"id": reqStr("网易云十进制 ID"), "name": reqStr("歌手名")}, "id", "name")
	registerSchema(t, "MusicAlbum", openapi3.Schemas{"id": reqStr("网易云十进制 ID"), "name": reqStr("专辑名"), "cover_url": reqStr("公开封面 URL")}, "id", "name", "cover_url")
	registerSchema(t, "MusicSong", openapi3.Schemas{"id": reqStr("网易云十进制 ID"), "name": reqStr("歌曲名"), "artists": refArray("歌手；无数据时为空数组", "MusicArtist"), "album": optRef("专辑", "MusicAlbum"), "duration_ms": optInt64("毫秒"), "fee": optInt("网易云付费类型，不代表播放授权")}, "id", "name", "artists", "album", "duration_ms", "fee")
	playlistFields := openapi3.Schemas{"id": reqStr("网易云十进制 ID"), "name": reqStr("歌单名"), "cover_url": reqStr("公开封面 URL"), "track_count": optInt("曲目数"), "creator": reqStr("创建者昵称")}
	registerSchema(t, "MusicPlaylist", playlistFields, "id", "name", "cover_url", "track_count", "creator")
	featuredFields := openapi3.Schemas{}
	for key, value := range playlistFields {
		featuredFields[key] = value
	}
	featuredFields["enabled"] = optBool("是否公开展示")
	featuredFields["position"] = optInt("零起始展示顺序")
	registerSchema(t, "MusicFeaturedPlaylist", featuredFields, "id", "name", "cover_url", "track_count", "creator", "enabled", "position")
	registerSchema(t, "MusicProfile", openapi3.Schemas{"id": reqStr("网易云账号 ID"), "nickname": reqStr("昵称"), "avatar_url": reqStr("公开头像 URL")}, "id", "nickname", "avatar_url")
	nullableProfile := &openapi3.SchemaRef{Value: &openapi3.Schema{Nullable: true, AllOf: openapi3.SchemaRefs{{Ref: "#/components/schemas/MusicProfile"}}}}
	registerSchema(t, "MusicAccount", openapi3.Schemas{"state": strEnum("连接状态", "disconnected", "connected", "expired"), "profile": nullableProfile}, "state", "profile")
	registerSchema(t, "MusicStatus", openapi3.Schemas{"configured": optBool("Kite 地址及令牌是否已配置；不发外呼"), "credential_storage_ready": optBool("独立加密密钥是否可用"), "base_url": reqStr("不含凭据的 Kite 地址")}, "configured", "credential_storage_ready", "base_url")
	registerSchema(t, "MusicVerification", openapi3.Schemas{"valid": optBool("健康与令牌验证是否均通过"), "message": reqStr("不含上游 body 或凭据的检查结果")}, "valid", "message")
	registerSchema(t, "MusicChallenge", openapi3.Schemas{"id": reqStr("本站不透明挑战 ID"), "url": reqStr("网易云二维码扫描 URL"), "expires_at": reqStr("RFC3339 过期时间；最长三分钟")}, "id", "url", "expires_at")
	nullableAccount := &openapi3.SchemaRef{Value: &openapi3.Schema{Nullable: true, AllOf: openapi3.SchemaRefs{{Ref: "#/components/schemas/MusicAccount"}}}}
	registerSchema(t, "MusicChallengeCheck", openapi3.Schemas{"state": strEnum("扫码状态", "waiting", "scanned", "confirmed", "expired"), "account": nullableAccount}, "state", "account")
	registerSchema(t, "MusicSongURL", openapi3.Schemas{"id": reqStr("歌曲 ID"), "url": nullableStr("匿名无播放权时 null；按需获取，不持久化"), "playable": optBool("是否有匿名可用地址"), "format": reqStr("文件格式"), "bitrate": optInt64("比特率"), "size": optInt64("字节数")}, "id", "url", "playable", "format", "bitrate", "size")
	registerSchema(t, "MusicLyric", openapi3.Schemas{"lrc": reqStr("原文 LRC"), "translated": reqStr("翻译 LRC"), "romanized": reqStr("音译 LRC")}, "lrc", "translated", "romanized")
	registerSchema(t, "MusicAddPlaylist", openapi3.Schemas{"playlist_id": reqStr("正整数十进制 ID；匿名验证可读后加入")}, "playlist_id")
	registerSchema(t, "MusicSetEnabled", openapi3.Schemas{"enabled": optBool("是否公开展示")}, "enabled")
	registerSchema(t, "MusicPlaylistOrder", openapi3.Schemas{"ids": strArray("全部展示歌单 ID 的完整无重复排列；原子提交")}, "ids")

	for _, endpoint := range []struct {
		method, path, summary, schema, body string
		array, paged                        bool
		status                              int
	}{
		{"GET", "/admin/music/status", "读取音乐部署状态", "MusicStatus", "", false, false, 200},
		{"POST", "/admin/music/verify", "验证 Kite 连接及服务令牌", "MusicVerification", "", false, false, 200},
		{"GET", "/admin/music/account", "查询站点网易云账号状态", "MusicAccount", "", false, false, 200},
		{"POST", "/admin/music/login/qr", "创建管理员专属扫码挑战", "MusicChallenge", "", false, false, 201},
		{"POST", "/admin/music/login/qr/{id}/check", "检查扫码并消费确认结果", "MusicChallengeCheck", "", false, false, 200},
		{"DELETE", "/admin/music/login/qr/{id}", "幂等取消自己的扫码挑战", "", "", false, false, 200},
		{"POST", "/admin/music/account/refresh", "续期并替换加密凭据", "MusicAccount", "", false, false, 200},
		{"DELETE", "/admin/music/account", "退出站点网易云账号", "", "", false, false, 200},
		{"GET", "/admin/music/library/playlists", "分页读取站点账号歌单", "MusicPlaylist", "", true, true, 200},
		{"GET", "/admin/music/library/playlists/{id}/tracks", "分页读取歌单曲目", "MusicSong", "", true, true, 200},
		{"GET", "/admin/music/playlists", "读取全部展示配置", "MusicFeaturedPlaylist", "", true, false, 200},
		{"POST", "/admin/music/playlists", "加入公开展示歌单", "MusicFeaturedPlaylist", "MusicAddPlaylist", false, false, 201},
		{"PATCH", "/admin/music/playlists/{id}", "启停展示歌单", "MusicFeaturedPlaylist", "MusicSetEnabled", false, false, 200},
		{"PUT", "/admin/music/playlists/order", "原子更新全部展示顺序", "MusicFeaturedPlaylist", "MusicPlaylistOrder", true, false, 200},
		{"DELETE", "/admin/music/playlists/{id}", "仅移除本站展示引用", "", "", false, false, 200},
		{"GET", "/music/playlists", "匿名读取启用的展示歌单", "MusicPlaylist", "", true, false, 200},
		{"GET", "/music/playlists/{id}/tracks", "匿名读取启用歌单的曲目", "MusicSong", "", true, true, 200},
		{"GET", "/music/songs/{id}", "匿名读取歌曲资料", "MusicSong", "", false, false, 200},
		{"GET", "/music/songs/{id}/url", "取得匿名播放地址", "MusicSongURL", "", false, false, 200},
		{"GET", "/music/songs/{id}/lyric", "匿名读取歌词", "MusicLyric", "", false, false, 200},
	} {
		op := &openapi3.Operation{Tags: []string{"音乐"}, Summary: endpoint.summary}
		if strings.HasPrefix(endpoint.path, "/admin/") {
			op.Security = securityAdmin()
			op.Description = "需 admin:access 与 music:view 权限。"
			if endpoint.method != "GET" {
				op.Description = "需 admin:access 与 music:manage 权限及 CSRF。"
				op.Parameters = append(op.Parameters, csrfHeaderParam())
			}
		} else {
			op.Description = "严格匿名调用 Kite；不读取站点账号凭据，即使浏览器带本站 session。"
		}
		if strings.Contains(endpoint.path, "{id}") {
			op.Parameters = append(op.Parameters, pathStrParam("id", "网易云正整数 ID；扫码路由为本站不透明挑战 ID"))
		}
		if endpoint.paged {
			op.Parameters = append(op.Parameters, pageParam(), limitParam(100))
		}
		if endpoint.path == "/music/songs/{id}/url" {
			p := queryStrParam("level", "默认 standard")
			p.Value.Schema = strEnum("音质", "standard", "exhigh", "lossless", "hires")
			op.Parameters = append(op.Parameters, p)
		}
		if endpoint.body != "" {
			op.RequestBody = jsonBody(endpoint.body, true, "操作参数")
		}
		success := messageResponse("操作成功，data 为 null")
		if endpoint.schema != "" {
			success = dataResponse(endpoint.schema, "操作结果", endpoint.status)
		}
		if endpoint.array {
			success = dataArrayResponse(endpoint.schema, "数组永不为 null", endpoint.status, endpoint.paged)
		}
		op.Responses = responses(endpoint.status, success, 400, errorResponse("输入、Kite 配置或网易云登录态错误；不会返回本站登录 401"), 404, errorResponse("未启用展示或资源不存在"), 409, errorResponse("重复歌单或账号已变更"), 500, errorResponse("存储或音乐服务错误"))
		if strings.HasPrefix(endpoint.path, "/music/") && endpoint.path != "/music/playlists" {
			op.Description += " 歌曲资料、播放地址、歌词与曲目查询共用每 IP 每分钟 60 次配额；超限返回 429 和 Retry-After。"
			op.Responses.Set("429", errorResponse("公开音乐查询过于频繁"))
		}
		if endpoint.path == "/admin/music/account" && endpoint.method == "DELETE" {
			op.Description += " 本地先清除凭据并使旧扫码和续期失效。若上游退出失败，返回400并明确本站已退出，不恢复凭据。"
		}
		if strings.Contains(endpoint.path, "/login/qr") {
			op.Description += " 挑战绑定创建者；过期、取消、消费或账号版本变化后返回 expired，不重新接入。取消与确认原子串行。"
		}
		setOp(t, endpoint.path, endpoint.method, op)
	}
	searchType := queryStrParam("type", "搜索类型")
	searchType.Value.Required = true
	searchType.Value.Schema = strEnum("搜索类型", "song", "playlist")
	query := queryStrParam("q", "搜索关键词，1至100字")
	query.Value.Required = true
	songResponse := dataArrayResponse("MusicSong", "歌曲搜索结果", 200, true)
	playlistResponse := dataArrayResponse("MusicPlaylist", "歌单搜索结果", 200, true)
	songSchema := songResponse.Value.Content["application/json"].Schema
	playlistSchema := playlistResponse.Value.Content["application/json"].Schema
	unionResponse := &openapi3.ResponseRef{Value: &openapi3.Response{Description: strPtr("按 type 返回歌曲或歌单分页信封"), Content: openapi3.Content{"application/json": &openapi3.MediaType{Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{OneOf: openapi3.SchemaRefs{songSchema, playlistSchema}}}}}}}
	get(t, "/admin/music/library/search", &openapi3.Operation{Tags: []string{"音乐"}, Summary: "匿名搜索歌曲或歌单", Description: "需 admin:access 与 music:view；不附加站点网易云 Cookie。", Security: securityAdmin(), Parameters: openapi3.Parameters{query, searchType, pageParam(), limitParam(100)}, Responses: responses(200, unionResponse, 400, errorResponse("搜索参数或 Kite 请求错误"))})
}
