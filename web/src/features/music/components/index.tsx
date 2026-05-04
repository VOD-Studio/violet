/**
 * 音乐播放器入口
 * 根据后台设置选择播放器版本，各组件独立管理自己的按钮
 */

import { useMusicSettings, useActivePlaylists } from "../api";
import { APlayerMusicPlayer } from "./APlayerMusicPlayer";
import { PlyrMusicPlayer } from "./PlyrMusicPlayer";

/**
 * 音乐播放器入口组件
 * 只负责选择播放器版本，各组件独立管理按钮和状态
 */
export function MusicPlayer() {
  const { data: settings } = useMusicSettings();
  const { data: playlists } = useActivePlaylists();

  // 没有启用的歌单，不显示播放器
  if (!playlists || playlists.length === 0) {
    return null;
  }

  const version = settings?.player_version || "v1";

  if (version === "v2") {
    return <PlyrMusicPlayer playlists={playlists} />;
  }

  // Convert to APlayer format
  const aplayerPlaylists = playlists.map((p) => ({
    id: p.id,
    server: p.platform,
    type: "playlist",
    playlistId: p.playlist_id,
    title: p.title,
    isActive: p.is_active,
  }));

  return <APlayerMusicPlayer playlists={aplayerPlaylists} />;
}
