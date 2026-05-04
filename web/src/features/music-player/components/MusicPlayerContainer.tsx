/**
 * 音乐播放器容器组件
 * 负责获取歌单数据并传递给 MusicPlayer
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MusicPlayer } from "./MusicPlayer";
import type { SongInfo } from "../types";

interface PlaylistResponse {
  playlists: Array<{
    id: string;
    title: string;
    cover: string;
    creator: string;
    count: number;
    platform: string;
    songs: SongInfo[];
  }>;
}

export function MusicPlayerContainer() {
  const { data } = useQuery({
    queryKey: ["music", "playlists", "active"],
    queryFn: async () => {
      try {
        const res = await api.get<PlaylistResponse>("/music/playlists/active");
        return res.playlists;
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const allSongs = data?.flatMap((playlist) => playlist.songs) ?? [];

  if (allSongs.length === 0) {
    return null;
  }

  return <MusicPlayer playlist={allSongs} />;
}
