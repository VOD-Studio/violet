/**
 * 音乐播放器入口
 * 根据后台设置选择播放器版本，各组件独立管理自己的按钮
 */

import { useQuery } from "@tanstack/react-query";
import { api, getUploadUrl } from "@/lib/api";
import { APlayerMusicPlayer } from "./APlayerMusicPlayer";
import { PlyrMusicPlayer } from "./PlyrMusicPlayer";
import type { Playlist, SongData } from "./usePlyrPlayer";

/** 播放器设置响应 */
interface MusicSettingsResponse {
  settings: {
    player_version: string;
  };
}

/** 歌单列表响应 */
interface PlaylistsResponse {
  playlists: Playlist[];
}

/** 获取播放器设置 */
function useMusicSettings() {
  return useQuery({
    queryKey: ["music", "settings"],
    queryFn: async () => {
      try {
        const res = await api.get<MusicSettingsResponse>("/music/settings");
        return res.settings;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** 获取启用的歌单 */
function useActivePlaylists() {
  return useQuery({
    queryKey: ["music", "playlists", "active"],
    queryFn: async () => {
      try {
        const res = await api.get<PlaylistsResponse>("/music/playlists/active");
        return res.playlists;
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

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

/** 将后端歌曲数据转换为播放器格式 */
export function toPlayerSongs(songs: SongData[]) {
  return songs
    .filter((s) => s.url)
    .map((s) => ({
      id: s.id,
      name: s.title || "未知歌曲",
      artist: s.artist || "未知艺术家",
      url: s.url.startsWith("/") ? getUploadUrl(s.url) : s.url,
      cover: s.cover ? getUploadUrl(s.cover) : s.cover,
      lrc: s.lrc as string | undefined,
    }));
}
