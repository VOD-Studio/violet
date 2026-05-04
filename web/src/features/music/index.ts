/**
 * 音乐功能模块公开 API
 * 统一导出所有公开的组件、hooks、类型和工具函数
 */

// 组件
export { MusicPlayer } from "./components/index";
export { PlyrMusicPlayer } from "./components/PlyrMusicPlayer";
export { APlayerMusicPlayer } from "./components/APlayerMusicPlayer";
export { VinylDisc } from "./components/VinylDisc";
export { PlayerControls } from "./components/PlayerControls";
export { PlayerProgress } from "./components/PlayerProgress";
export { PlayerVolume } from "./components/PlayerVolume";
export { PlayerPlaylist } from "./components/PlayerPlaylist";
export { MarqueeText } from "./components/MarqueeText";

// Legacy 组件（用于 Music 页面）
export { MusicPlayer as MusicPlayerLegacy, SongList } from "./components/MusicPlayerLegacy";
export type { SongInfo, PlaylistInfo } from "./components/MusicPlayerLegacy";

// Hooks
export { usePlyrPlayer } from "./hooks/usePlyrPlayer";
export { useMusicSettings, useActivePlaylists, musicKeys } from "./api";

// Types
export type { Song, SongData, Playlist } from "./hooks/usePlyrPlayer";

// Utils
export { toPlayerSongs, formatTime, parseLRC } from "./utils";
