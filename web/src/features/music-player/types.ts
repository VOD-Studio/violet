/** 歌曲信息 */
export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  url: string;
  platform: string;
}

/** 歌单信息 */
export interface PlaylistInfo {
  id: string;
  title: string;
  cover: string;
  creator: string;
  count: number;
  platform: string;
  songs: SongInfo[];
}

/** 播放模式 */
export type PlayMode = "sequence" | "loop" | "single" | "shuffle";

/** 播放器状态 */
export interface PlayerState {
  currentSong: SongInfo | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  playlist: SongInfo[];
}

/** 播放器组件属性 */
export interface MusicPlayerProps {
  playlist: SongInfo[];
  className?: string;
  onEnded?: () => void;
}
