/**
 * admin-music 模块类型定义
 *
 * 后台歌单管理的写操作请求体。领域读模型 Playlist、Song 见 entities/music。
 */

/** ImportPlaylistRequest - 导入歌单请求体，url 必填 */
export interface ImportPlaylistRequest {
    /** 第三方歌单链接，必填 */
    url: string;
}

/** CreateCustomPlaylistRequest - 创建自定义歌单请求体，title 必填 */
export interface CreateCustomPlaylistRequest {
    /** 歌单标题，必填 */
    title: string;
}

/** UpdatePlaylistRequest - 更新歌单请求体，字段可选指针，传值才更新 */
export interface UpdatePlaylistRequest {
    /** 歌单标题，传值才更新 */
    title?: string;
    /** 是否启用，传值才更新 */
    is_active?: boolean;
}

/** SetPlaylistActiveRequest - 启用/禁用歌单请求体 */
export interface SetPlaylistActiveRequest {
    /** 目标启用状态 */
    active: boolean;
}

/** AddSongRequest - 添加歌曲到歌单请求体，字段均可选 */
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

/** UpdateSongRequest - 更新歌单内歌曲请求体，后端用零值判断跳过 */
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

/** UpdatePlayerSettingsRequest - 更新播放器设置请求体，player_version 必填 */
export interface UpdatePlayerSettingsRequest {
    /** 播放器版本号，必填 */
    player_version: string;
}
