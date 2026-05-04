/** 歌曲数据 */
export interface Song {
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrc?: string;
}

/** 歌单数据 */
export interface PlaylistItem {
  id: string;
  title: string;
  cover: string;
  creator: string;
  platform: string;
  playlist_id: string;
  song_count: number;
  is_active: boolean;
  created_at: string;
  songs?: Song[];
}

/** 歌单列表响应 */
export interface PlaylistListResponse {
  playlists: PlaylistItem[];
  total: number;
}

/** 播放器设置响应 */
export interface MusicSettingsResponse {
  settings: {
    player_version: string;
  };
}

/** 搜索结果 */
export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  platform: string;
  url: string;
  lrc: string;
}
