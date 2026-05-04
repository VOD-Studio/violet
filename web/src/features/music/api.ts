/**
 * 音乐功能 API 层
 * 集中管理所有音乐相关的 API 调用和 react-query hooks
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Playlist } from "./hooks/usePlyrPlayer";

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

/** Query Keys */
export const musicKeys = {
  all: ["music"] as const,
  settings: () => [...musicKeys.all, "settings"] as const,
  playlists: () => [...musicKeys.all, "playlists"] as const,
  activePlaylists: () => [...musicKeys.playlists(), "active"] as const,
};

/**
 * 获取播放器设置
 * 返回播放器版本配置（v1: APlayer, v2: Plyr）
 */
export function useMusicSettings() {
  return useQuery({
    queryKey: musicKeys.settings(),
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

/**
 * 获取启用的歌单列表
 * 只返回 is_active = true 的歌单
 */
export function useActivePlaylists() {
  return useQuery({
    queryKey: musicKeys.activePlaylists(),
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
