/**
 * music 模块类型定义
 *
 * 领域读模型 Playlist、Song 见 entities/music，此处转出供前台消费。
 * 后台歌单管理写操作请求体见 admin-music。
 *
 * 公开解析返回的 EmbedInfo/SongMeta/PlaylistMeta 无 json tag，
 * Go 默认按字段名输出为 PascalCase，故此处对应字段用 PascalCase。
 */
import type { Playlist, Song } from "@entities/music/model/types";

// 领域读模型转出
export type { Playlist, Song };

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
 * 对应后端 domain/music/repository.go 的 EmbedInfo，无 json tag，PascalCase。
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
 * keyword 必填，limit 省略时默认 10。
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
 * id 必填，platform 可选，省略时后端默认走 netease。
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
