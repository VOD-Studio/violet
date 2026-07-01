/**
 * music 模块类型定义
 *
 * 对接后端 application/media/service.go 与 domain/music/entity.go。
 * 读取字段分两类序列化形态：
 * - DTO 与领域 Song 带 json tag，序列化为 snake_case；
 * - 公开解析返回的 EmbedInfo/SongMeta/PlaylistMeta 无 json tag，
 *   Go 默认按字段名输出为 PascalCase，故此处对应字段用 PascalCase。
 *
 * 后台歌单管理写操作请求体见 admin-music。
 */

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
    /** 歌单 ID，UUID */
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
    /** 创建时间，RFC3339，后端当前未填充，恒为空串 */
    created_at?: string;
    /** 更新时间，RFC3339，后端当前未填充，恒为空串 */
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

/**
 * EmbedInfo - 音乐嵌入信息
 *
 * 对应后端 domain/music/repository.go 的 EmbedInfo，无 json tag，
 * Go 默认按字段名序列化为 PascalCase。
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
 * 对应后端 domain/music/repository.go 的 SongMeta，无 json tag，PascalCase。
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
 * 对应后端 domain/music/repository.go 的 PlaylistMeta，无 json tag，PascalCase。
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

/**
 * MusicSearchQuery - 搜索歌曲查询参数
 *
 * 后端 SearchSongs 解析 keyword 与 limit，keyword 必填，limit 省略时默认 10。
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
 * id 必填，platform 可选，省略时后端默认走 netease 解析路径。
 */
export interface MusicSongQuery {
    /** 平台内歌曲 ID，必填 */
    id: string;
    /** 来源平台标识，省略时后端默认 netease */
    platform?: string;
}

/** MusicEmbedQuery - 解析音乐链接查询参数 */
export interface MusicEmbedQuery {
    /** 音乐链接，必填，支持网易云与 QQ 音乐 */
    url: string;
}

/** MusicPlaylistQuery - 解析歌单链接查询参数 */
export interface MusicPlaylistQuery {
    /** 歌单链接，必填 */
    url: string;
}
