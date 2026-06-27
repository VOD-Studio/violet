/**
 * music 模块类型定义
 *
 * 对接后端 application/media/service.go 与 domain/music/entity.go。
 * 读取字段分两类序列化形态：
 * - DTO 与领域 Song 带 json tag，序列化为 snake_case；
 * - 公开解析返回的 EmbedInfo/SongMeta/PlaylistMeta 无 json tag，
 *   Go 默认按字段名输出为 PascalCase，故此处对应字段用 PascalCase。
 * 若后端后续为这三类补 json tag，需同步改此处为 snake_case。
 */

// ============================================================
// 读模型（snake_case，DTO 与领域 Song 带 json tag）
// ============================================================

/**
 * Song - 歌曲信息
 *
 * 对应后端 domain/music/entity.go 的 Song，作为 JSONB 内联在 PlaylistDTO.songs。
 * SearchSongs 与 FetchSongDetail 也返回此结构。字段均带 json tag。
 */
export interface Song {
    /** 歌曲名 */
    name: string;
    /** 艺人名 */
    artist: string;
    /** 播放地址 */
    url: string;
    /** 封面图 URL */
    cover: string;
}

/**
 * Playlist - 歌单读模型
 *
 * 对应后端 application/media/service.go 的 PlaylistDTO，字段均带 json tag。
 * 后端 playlistToDTO 未填充 created_at 与 updated_at，二者实际恒为空串，
 * 故标可选，消费方按可选处理。
 */
export interface Playlist {
    /** 歌单 ID（UUID） */
    id: string;
    /** 歌单标题 */
    title: string;
    /** 歌单封面 URL，自定义歌单为空 */
    cover: string;
    /** 歌单创建者，第三方导入时可能为空 */
    creator: string;
    /** 来源平台标识，如 netease/tencent/custom */
    platform: string;
    /** 第三方歌单 ID，自定义歌单为空 */
    playlist_id: string;
    /** 歌曲总数，等于 songs 长度 */
    song_count: number;
    /** 歌曲列表，JSONB 内联 */
    songs: Song[];
    /** 是否启用，公开接口仅返回启用歌单 */
    is_active: boolean;
    /** 创建时间（RFC3339），后端当前未填充，恒为空串 */
    created_at?: string;
    /** 更新时间（RFC3339），后端当前未填充，恒为空串 */
    updated_at?: string;
}

/**
 * MusicSettings - 播放器设置读模型
 *
 * 对应后端 MusicSettingsDTO，当前仅含播放器版本号。
 */
export interface MusicSettings {
    /** 播放器版本号 */
    player_version: string;
}

// ============================================================
// 公开解析返回类型（PascalCase，后端 domain struct 无 json tag）
// ============================================================

/**
 * EmbedInfo - 音乐嵌入信息
 *
 * 对应后端 domain/music/repository.go 的 EmbedInfo，无 json tag，
 * Go 默认按字段名序列化为 PascalCase。
 * GetMusicEmbed 接口返回此结构，供前端拼接嵌入播放器。
 */
export interface EmbedInfo {
    /** 来源平台标识，netease 或 tencent */
    Platform: string;
    /** 平台内歌曲 ID */
    SongID: string;
    /** 可直接 iframe 嵌入的播放器 URL */
    EmbedURL: string;
}

/**
 * SongMeta - 歌曲元数据
 *
 * 对应后端 domain/music/repository.go 的 SongMeta，无 json tag，
 * 字段序列化为 PascalCase。
 * GetSongMeta 接口返回封面与歌词合并结果。
 */
export interface SongMeta {
    /** 封面图 URL */
    Cover: string;
    /** LRC 歌词文本，可能含时间标签 */
    Lyrics: string;
}

/**
 * PlaylistMeta - 歌单解析元数据
 *
 * 对应后端 domain/music/repository.go 的 PlaylistMeta，无 json tag，
 * 字段序列化为 PascalCase。
 * ParsePlaylist 接口返回第三方歌单解析结果，title/creator/cover 可能为空。
 */
export interface PlaylistMeta {
    /** 歌单标题 */
    Title: string;
    /** 歌单封面 URL */
    Cover: string;
    /** 歌单创建者 */
    Creator: string;
    /** 来源平台标识 */
    Platform: string;
    /** 第三方歌单 ID */
    PlaylistID: string;
    /** 解析出的歌曲列表 */
    Songs: Song[];
}

// ============================================================
// 请求体（snake_case，对应 handler 内联结构带 json tag）
// ============================================================

/**
 * ImportPlaylistRequest - 导入歌单请求体
 *
 * 对应后端 CreatePlaylist handler 的内联结构，url 必填。
 * 后端解析链接拉取歌曲后创建歌单，返回 Playlist。
 */
export interface ImportPlaylistRequest {
    /** 第三方歌单链接，必填 */
    url: string;
}

/**
 * CreateCustomPlaylistRequest - 创建自定义歌单请求体
 *
 * 对应后端 CreateCustomPlaylist handler 的内联结构，title 必填。
 * 后端创建 platform 为 custom 的空歌单。
 */
export interface CreateCustomPlaylistRequest {
    /** 歌单标题，必填 */
    title: string;
}

/**
 * UpdatePlaylistRequest - 更新歌单请求体
 *
 * 对应后端 UpdatePlaylist handler 的内联结构。
 * title 与 is_active 均为可选指针，传值才更新，省略保持原值。
 */
export interface UpdatePlaylistRequest {
    /** 歌单标题，传值才更新 */
    title?: string;
    /** 是否启用，传值才更新 */
    is_active?: boolean;
}

/**
 * SetPlaylistActiveRequest - 启用/禁用歌单请求体
 *
 * 对应后端 SetPlaylistActive handler 的内联结构，active 控制目标状态。
 */
export interface SetPlaylistActiveRequest {
    /** 目标启用状态 */
    active: boolean;
}

/**
 * AddSongRequest - 添加歌曲到歌单请求体
 *
 * 对应后端 AddSongToPlaylist handler 的内联结构，字段均可选。
 */
export interface AddSongRequest {
    /** 歌曲名 */
    name?: string;
    /** 艺人名 */
    artist?: string;
    /** 播放地址 */
    url?: string;
    /** 封面图 URL */
    cover?: string;
}

/**
 * UpdateSongRequest - 更新歌单内歌曲请求体
 *
 * 对应后端 UpdateSongInPlaylist handler 的内联结构。
 * 后端用零值判断跳过，空串不会清空字段。
 */
export interface UpdateSongRequest {
    /** 歌曲名 */
    name?: string;
    /** 艺人名 */
    artist?: string;
    /** 播放地址 */
    url?: string;
    /** 封面图 URL */
    cover?: string;
}

/**
 * UpdatePlayerSettingsRequest - 更新播放器设置请求体
 *
 * 对应后端 UpdatePlayerVersion handler 的内联结构，player_version 必填。
 */
export interface UpdatePlayerSettingsRequest {
    /** 播放器版本号，必填 */
    player_version: string;
}

// ============================================================
// 查询参数
// ============================================================

/**
 * MusicSearchQuery - 搜索歌曲查询参数
 *
 * 后端 SearchSongs handler 解析 keyword 与 limit，keyword 必填，
 * limit 省略时后端默认 10。
 */
export interface MusicSearchQuery {
    /** 搜索关键词，必填 */
    keyword: string;
    /** 返回条数上限，默认 10 */
    limit?: number;
}

/**
 * MusicSongQuery - 获取歌曲详情/歌词/元数据查询参数
 *
 * 后端 GetSongDetail/GetLyrics/GetSongMeta 共用此参数形态。
 * id 必填，platform 可选，省略时后端默认走 netease 解析路径。
 */
export interface MusicSongQuery {
    /** 平台内歌曲 ID，必填 */
    id: string;
    /** 来源平台标识，省略时后端默认 netease */
    platform?: string;
}

/**
 * MusicEmbedQuery - 解析音乐链接查询参数
 */
export interface MusicEmbedQuery {
    /** 音乐链接，必填，支持网易云与 QQ 音乐 */
    url: string;
}

/**
 * MusicPlaylistQuery - 解析歌单链接查询参数
 */
export interface MusicPlaylistQuery {
    /** 歌单链接，必填 */
    url: string;
}
