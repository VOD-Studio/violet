/**
 * 音乐播放器入口
 * 根据后台设置选择播放器版本，各组件独立管理自己的按钮
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GlobalMusicPlayer } from "./GlobalMusicPlayer";
import { PlyrMusicPlayer } from "./PlyrMusicPlayer";

/** 播放器设置响应 */
interface MusicSettingsResponse {
  settings: {
    player_version: string;
  };
}

/** 歌单列表响应 */
interface PlaylistsResponse {
  playlists: Array<{
    id: string;
    title: string;
    server: string;
    playlistId: string;
    type: string;
    isActive: boolean;
  }>;
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

  return <GlobalMusicPlayer playlists={playlists} />;
}