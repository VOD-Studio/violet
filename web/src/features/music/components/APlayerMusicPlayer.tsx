/**
 * APlayer 音乐播放器 (v1)
 * 使用 APlayer + Meting 实现，支持网易云/QQ音乐完整歌单
 * 独立管理按钮和状态
 */

import { useEffect, useRef, useState } from "react";
import APlayer from "aplayer";
import "aplayer/dist/APlayer.min.css";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Loader2 } from "lucide-react";

interface PlaylistConfig {
  id: string;
  server: string;
  type: string;
  playlistId: string;
  title: string;
  isActive: boolean;
}

interface APlayerMusicPlayerProps {
  playlists: PlaylistConfig[];
}

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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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

export function APlayerMusicPlayer({ playlists }: APlayerMusicPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<APlayer | null>(null);
  const [songs, setSongs] = useState<APlayer.Audio[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<{ name: string; artist: string } | null>(null);

  // 使用第一个歌单
  const config = playlists[0];

  // 获取歌曲列表
  useEffect(() => {
    if (!config) {
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
    if (!expanded || !containerRef.current || songs.length === 0) return;

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

      player.on("play", () => {
        setIsPlaying(true);
        const index = player.list.index;
        if (index >= 0 && songs[index]) {
          setCurrentSong({ name: songs[index].name, artist: songs[index].artist });
        }
      });

      player.on("pause", () => {
        setIsPlaying(false);
      });

      player.on("listswitch", () => {
        const index = player.list.index;
        if (index >= 0 && songs[index]) {
          setCurrentSong({ name: songs[index].name, artist: songs[index].artist });
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
  }, [expanded, songs]);

  if (!config || songs.length === 0) return null;

  const buttonText = loading
    ? "加载中..."
    : expanded
      ? "收起"
      : isPlaying && currentSong
        ? `${currentSong.name} - ${currentSong.artist}`
        : config.title || "音乐";

  return (
    <div className="fixed right-4 z-40" style={{ bottom: "13rem" }}>
      {/* 按钮 - 无 hover/scale 效果 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg transition-colors max-w-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : isPlaying && !expanded ? (
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
            <Play className="h-4 w-4" />
          </motion.div>
        ) : (
          <Music className="h-4 w-4 shrink-0" />
        )}

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
      </button>

      {/* 播放器容器 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-2 right-0 bg-background/95 backdrop-blur rounded-lg shadow-lg overflow-hidden max-w-sm w-80"
          >
            <div ref={containerRef} className="aplayer-container" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}