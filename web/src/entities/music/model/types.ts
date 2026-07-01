/**
 * Playlist 与 Song - 音乐领域实体
 *
 * 前台播放器与后台歌单管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/media、entities/post。
 */

/**
 * Song - 歌曲信息
 *
 * 对应后端 domain/music/entity.go 的 Song，作为 JSONB 内联在 PlaylistDTO.songs。
 * 字段均带 json tag。
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
 * 后端 playlistToDTO 未填充 created_at 与 updated_at，二者恒为空串，故标可选。
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
