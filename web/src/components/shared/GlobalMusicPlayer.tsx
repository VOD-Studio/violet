/**
 * 全局音乐播放器
 * 使用 APlayer + Meting 实现，支持网易云/QQ音乐完整歌单
 */

import { useEffect, useRef, useState } from "react";
import APlayer from "aplayer";
import "aplayer/dist/APlayer.min.css";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { api } from "@/lib/api";
import { Music, Play } from "lucide-react";

/** 歌单配置 */
interface PlaylistConfig {
  id: string;
  server: "netease" | "tencent" | "kugou" | "baidu";
  type: "playlist" | "song" | "album" | "artist";
  playlistId: string;
  title: string;
  isActive: boolean;
}

/** 获取活跃歌单配置 */
function useActivePlaylistConfig() {
  return useQuery({
    queryKey: ["playlist", "config", "active"],
    queryFn: async () => {
      try {
        const res = await api.get<{ playlist: PlaylistConfig | null }>(
          "/music/playlist/config/active"
        );
        return res.playlist;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 使用 Meting API 获取歌曲列表
 */
async function fetchMetingSongs(
  server: string,
  type: string,
  id: string
): Promise<APlayer.Audio[]> {
  const apiUrls = [
    "https://api.injahow.cn/meting/",
    "https://api.meting.js.org",
    "https://api.i-meto.com/meting/api",
  ];

  for (const apiUrl of apiUrls) {
    try {
      const url = `${apiUrl}?server=${server}&type=${type}&id=${id}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        return data.map((song: any) => ({
          name: song.name || song.title,
          artist: song.artist || "",
          url: song.url,
          cover: song.pic || song.cover,
          lrc: song.lrc,
        }));
      }
    } catch (e) {
      console.warn(`Meting API ${apiUrl} failed:`, e);
    }
  }

  return [];
}

/**
 * 全局音乐播放器组件
 * 右下角悬浮按钮，点击展开播放器
 */
export function GlobalMusicPlayer() {
  const { data: config } = useActivePlaylistConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<APlayer | null>(null);
  const [songs, setSongs] = useState<APlayer.Audio[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<{
    name: string;
    artist: string;
  } | null>(null);

  // 获取歌曲列表
  useEffect(() => {
    if (!config || !config.isActive) {
      setSongs([]);
      return;
    }

    setLoading(true);
    fetchMetingSongs(config.server, config.type, config.playlistId)
      .then((data) => {
        setSongs(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [config]);

  // 初始化 APlayer 并监听播放事件
  useEffect(() => {
    if (!containerRef.current || songs.length === 0) return;

    if (!playerRef.current) {
      const player = new APlayer({
        container: containerRef.current,
        mutex: true,
        preload: "metadata",
        listFolded: true,
        listMaxHeight: "200px",
        lrcType: 3,
        audio: songs,
      });

      // 监听播放事件
      player.on("play", () => {
        setIsPlaying(true);
        const index = player.list.index;
        if (index >= 0 && songs[index]) {
          setCurrentSong({
            name: songs[index].name,
            artist: songs[index].artist,
          });
        }
      });

      player.on("pause", () => {
        setIsPlaying(false);
      });

      player.on("listswitch", () => {
        const index = player.list.index;
        if (index >= 0 && songs[index]) {
          setCurrentSong({
            name: songs[index].name,
            artist: songs[index].artist,
          });
        }
      });

      playerRef.current = player;
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [songs]);

  // 无歌单时不显示
  if (!config?.isActive) return null;

  // 按钮内容根据状态变化
  const buttonText = loading
    ? "加载中..."
    : expanded
      ? "收起"
      : isPlaying && currentSong
        ? `${currentSong.name} - ${currentSong.artist}`
        : config.title || "音乐";

  return (
    <div className="fixed right-4 z-40" style={{ bottom: "13rem" }}>
      {/* 展开/收起按钮 */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors max-w-50"
        title={expanded ? "收起播放器" : "展开播放器"}
      >
        {/* 播放状态图标 */}
        {isPlaying && !expanded ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Play className="h-4 w-4" />
          </motion.div>
        ) : (
          <Music className="h-4 w-4 shrink-0" />
        )}

        {/* 文字 - 宽度动画 */}
        <AnimatePresence mode="wait">
          <motion.span
            key={buttonText}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium truncate overflow-hidden"
          >
            {buttonText}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* 播放器容器 */}
      <motion.div
        initial={false}
        animate={{
          opacity: expanded ? 1 : 0,
          y: expanded ? 0 : -10,
          scale: expanded ? 1 : 0.95,
          pointerEvents: expanded ? "auto" : "none",
        }}
        transition={{ duration: 0.2 }}
        className="absolute bottom-full mb-2 right-0 bg-background/95 backdrop-blur rounded-lg shadow-lg overflow-hidden max-w-sm w-80"
      >
        <div ref={containerRef} className="aplayer-container" />
      </motion.div>
    </div>
  );
}
