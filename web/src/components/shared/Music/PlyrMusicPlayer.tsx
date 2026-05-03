/**
 * 音乐播放器组件
 * - 迷你碟片：右下角旋转唱片，显示当前播放状态
 * - 展开面板：完整播放控制（上一首/播放暂停/下一首/进度/音量/歌单/列表）
 * - 播放失败自动跳到下一首
 * - 歌曲列表自动滚动到当前播放项
 * - 同步歌词显示
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { getUploadUrl } from "@/lib/api";
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  ChevronDown,
} from "lucide-react";

/** 歌曲信息 */
interface Song {
  id: string;
  name: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
}

/** 歌单信息 */
interface Playlist {
  id: string;
  title: string;
  cover?: string;
  creator?: string;
  platform: string;
  playlist_id: string;
  song_count: number;
  songs: Array<{
    id: string;
    title: string;
    artist: string;
    url: string;
    cover?: string;
    lrc?: string;
  }>;
  is_active: boolean;
}

/** 歌词行 */
interface LyricLine {
  time: number;
  text: string;
}

/** 解析 LRC 格式歌词 */
function parseLRC(lrc?: string): LyricLine[] {
  if (!lrc) return [];
  const lines = lrc.split("\n");
  const result: LyricLine[] = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, "0"));
      result.push({
        time: minutes * 60 + seconds + ms / 1000,
        text: match[4].trim(),
      });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

/** 根据 currentTime 找到当前歌词行索引 */
function findCurrentLyricIndex(lyrics: LyricLine[], time: number): number {
  if (lyrics.length === 0) return -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (time >= lyrics[i].time) return i;
  }
  return -1;
}

/** 唱片碟片组件 */
function VinylDisc({
  cover,
  isPlaying,
  size,
}: {
  cover?: string;
  isPlaying: boolean;
  size: number;
}) {
  const coverSize = size * 0.55;
  const holeSize = Math.max(size * 0.06, 4);

  return (
    <div
      className="relative rounded-full bg-linear-to-br from-gray-700 to-gray-900 shadow-lg ring-2 ring-white/10"
      style={{
        width: size,
        height: size,
        animation: "music-disc-spin 8s linear infinite",
        animationPlayState: isPlaying ? "running" : "paused",
      }}
    >
      <div
        className="absolute inset-0 rounded-full opacity-[0.08]"
        style={{
          background:
            "repeating-radial-gradient(circle, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)",
        }}
      />

      <div
        className="absolute rounded-full overflow-hidden ring-1 ring-white/10"
        style={{
          width: coverSize,
          height: coverSize,
          top: (size - coverSize) / 2,
          left: (size - coverSize) / 2,
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/30 to-primary/60">
            <Music
              className="text-white"
              style={{ width: size * 0.18, height: size * 0.18 }}
            />
          </div>
        )}
      </div>

      <div
        className="absolute z-10 rounded-full bg-gray-800"
        style={{
          width: holeSize,
          height: holeSize,
          top: (size - holeSize) / 2,
          left: (size - holeSize) / 2,
        }}
      />
    </div>
  );
}

/** 溢出时自动滚动的文字 */
function MarqueeText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth);
  }, [children]);

  if (!overflow) {
    return (
      <span ref={ref} className={cn("truncate block", className)}>
        {children}
      </span>
    );
  }

  return (
    <span className="block overflow-hidden" aria-label={children}>
      <span ref={ref} className={cn("marquee-text", className)}>
        {children}&emsp;{children}&emsp;
      </span>
    </span>
  );
}

interface PlyrMusicPlayerProps {
  playlists: Playlist[];
}

export function PlyrMusicPlayer({ playlists }: PlyrMusicPlayerProps) {
  const [expanded, setExpanded] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  // 底部面板视图：歌词 / 列表
  const [panelView, setPanelView] = useState<"list" | "lyrics">("list");
  // 歌词文本（lrc 可能是 URL，需要异步解析）
  const [lyricsText, setLyricsText] = useState("");
  // 播放器位置状态（用 right 定位，初始 right-4 即 16px）
  const [position, setPosition] = useState({ right: 16, bottom: 240 });
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posRight: 0, posBottom: 0 });
  const hasMovedRef = useRef(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const songsLengthRef = useRef(songs.length);
  songsLengthRef.current = songs.length;
  const skipPauseRef = useRef(false);
  const stopAfterLoadRef = useRef(false);
  const errorCountRef = useRef(0);
  // 是否应该自动播放（意图），与 isPlaying（事实）分离
  const shouldAutoPlayRef = useRef(false);
  // 标记是否已完成首次歌单加载（用于区分初始加载/HMR重载 vs 用户主动切歌单）
  const initialLoadDoneRef = useRef(false);
  const songListRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // 拖拽处理函数
  const handleDragStart = useCallback(
    (clientX: number, clientY: number) => {
      setIsDragging(true);
      hasMovedRef.current = false;
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        posRight: position.right,
        posBottom: position.bottom,
      };
    },
    [position]
  );

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      // 超过阈值才算真正拖拽
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMovedRef.current = true;
      }

      const playerWidth = playerRef.current?.offsetWidth || 52;
      const playerHeight = playerRef.current?.offsetHeight || 52;

      // 边界检测：
      // - right: 往左拖(deltaX>0)时 right 增加，往右拖(deltaX<0)时 right 减小
      // - bottom: 往下拖(deltaY>0)时 bottom 减小，往上拖(deltaY<0)时 bottom 增加
      const newRight = Math.max(
        0,
        Math.min(
          window.innerWidth - playerWidth,
          dragStartRef.current.posRight - deltaX
        )
      );
      const newBottom = Math.max(
        0,
        Math.min(
          window.innerHeight - playerHeight,
          dragStartRef.current.posBottom - deltaY
        )
      );

      setPosition({ right: newRight, bottom: newBottom });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 鼠标事件
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleDragStart(e.clientX, e.clientY);
    },
    [handleDragStart]
  );

  // 触摸事件
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    },
    [handleDragStart]
  );

  // 全局事件监听
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };

    const handleEnd = () => {
      handleDragEnd();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const currentPlaylist = playlists[currentPlaylistIndex];
  const currentSong = songs[currentSongIndex] || null;

  // 解析歌词文本（lrc 可能是原始文本或 URL）
  useEffect(() => {
    if (!currentSong?.lrc) {
      setLyricsText("");
      return;
    }
    if (currentSong.lrc.startsWith("http")) {
      fetch(currentSong.lrc)
        .then((res) => res.text())
        .then((text) => setLyricsText(text))
        .catch(() => setLyricsText(""));
    } else {
      setLyricsText(currentSong.lrc);
    }
  }, [currentSong]);

  const lyrics = parseLRC(lyricsText);
  const currentLyricIndex = findCurrentLyricIndex(lyrics, currentTime);

  // 加载歌单歌曲（直接使用后端缓存数据）
  useEffect(() => {
    if (!currentPlaylist) return;

    setSongsLoading(true);
    setCurrentSongIndex(0);
    setIsPlaying(false);

    const mapped = currentPlaylist.songs
      .filter((s) => s.url)
      .map((s) => ({
        id: s.id,
        name: s.title || "未知歌曲",
        artist: s.artist || "未知艺术家",
        url: s.url.startsWith("/") ? getUploadUrl(s.url) : s.url,
        cover: s.cover ? getUploadUrl(s.cover) : s.cover,
        lrc: s.lrc,
      }));

    setSongs(mapped);
    if (mapped.length > 0) {
      shouldAutoPlayRef.current = initialLoadDoneRef.current;
    }
    setSongsLoading(false);
    initialLoadDoneRef.current = true;
  }, [currentPlaylist]);

  // 音频事件监听（仅在挂载时注册一次）
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => {
      errorCountRef.current = 0;
      setIsPlaying(true);
    };
    const handlePause = () => {
      if (!skipPauseRef.current) setIsPlaying(false);
    };
    const handleEnded = () => {
      errorCountRef.current = 0;
      const len = songsLengthRef.current;
      setCurrentSongIndex((prev) => {
        if (prev < len - 1) return prev + 1;
        stopAfterLoadRef.current = true;
        return 0;
      });
    };
    const handleError = () => {
      const len = songsLengthRef.current;
      errorCountRef.current += 1;
      if (len <= 1 || errorCountRef.current >= len) {
        // 只有一首歌或全部失败，停止播放
        skipPauseRef.current = false;
        setIsPlaying(false);
        return;
      }
      // 跳到下一首
      setCurrentSongIndex((prev) => (prev + 1) % len);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, []);

  // 切换歌曲
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || !currentSong.url) return;

    if (playPromiseRef.current) {
      playPromiseRef.current.catch(() => {});
      playPromiseRef.current = null;
    }

    skipPauseRef.current = true;
    audio.src = currentSong.url;
    audio.load();

    if (stopAfterLoadRef.current) {
      stopAfterLoadRef.current = false;
      shouldAutoPlayRef.current = false;
      skipPauseRef.current = false;
      return;
    }

    if (shouldAutoPlayRef.current) {
      const promise = audio.play();
      playPromiseRef.current = promise;
      promise.then(
        () => {
          skipPauseRef.current = false;
        },
        () => {
          skipPauseRef.current = false;
        }
      );
    } else {
      skipPauseRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  // 歌曲列表自动滚动到当前播放项
  useEffect(() => {
    if (!expanded || panelView !== "list") return;
    const el = songListRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentSongIndex, expanded, panelView]);

  // 歌词自动滚动到当前行
  useEffect(() => {
    if (panelView !== "lyrics") return;
    const container = lyricsContainerRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentLyricIndex, panelView]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      shouldAutoPlayRef.current = false;
      audio.pause();
    } else {
      shouldAutoPlayRef.current = true;
      const promise = audio.play();
      playPromiseRef.current = promise;
      promise.catch(() => {});
    }
  }, [isPlaying, currentSong]);

  const playPrev = useCallback(() => {
    if (songs.length === 0) return;
    shouldAutoPlayRef.current = true;
    setCurrentSongIndex((prev) => (prev > 0 ? prev - 1 : songs.length - 1));
  }, [songs.length]);

  const playNext = useCallback(() => {
    if (songs.length === 0) return;
    shouldAutoPlayRef.current = true;
    setCurrentSongIndex((prev) => (prev < songs.length - 1 ? prev + 1 : 0));
  }, [songs.length]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (audioRef.current) audioRef.current.volume = newVolume;
      if (newVolume > 0) setIsMuted(false);
    },
    []
  );

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.muted = newMuted;
  }, [isMuted]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSwitchPlaylist = useCallback(
    (index: number) => {
      if (index === currentPlaylistIndex) return;
      setCurrentPlaylistIndex(index);
      setShowPlaylist(false);
    },
    [currentPlaylistIndex]
  );

  const handleSongClick = useCallback(
    (index: number) => {
      if (index === currentSongIndex && !isPlaying) {
        togglePlay();
        return;
      }
      setCurrentSongIndex(index);
    },
    [currentSongIndex, isPlaying, togglePlay]
  );

  // 面板边界处理
  const padding = 16;
  const panelWidth = 340; // w-85 = 85 * 4
  // 向上展开可用空间 = 碟片底部到视口顶部
  const spaceAbove = window.innerHeight - position.bottom;
  // 向下展开可用空间 = 碟片底部到视口底部
  const spaceBelow = position.bottom;
  // 上方空间不足 450px 时向下展开
  const expandDown = spaceAbove < 450;
  // 左侧空间不足时，面板向右偏移以贴住视口左边缘
  const spaceToLeft = window.innerWidth - position.right;
  const rightOffset = -Math.max(0, panelWidth - spaceToLeft);

  const panelPositionStyle: React.CSSProperties = expandDown
    ? { top: "100%", right: rightOffset }
    : { bottom: 0, right: rightOffset };

  const panelMaxHeight = expandDown
    ? `${spaceBelow - padding}px`
    : `${spaceAbove - padding}px`;

  const panelOrigin = expandDown ? "origin-top-right" : "origin-bottom-right";
  const panelAnimY = expandDown ? -16 : 16;

  return (
    <>
      <style>{`
        @keyframes music-disc-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes music-bar {
          from { height: 3px; }
          to { height: 10px; }
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .marquee-text {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-scroll 10s linear infinite;
        }
      `}</style>

      <audio ref={audioRef} preload="metadata" />

      <div
        ref={playerRef}
        className="fixed z-50"
        style={{ right: position.right, bottom: position.bottom }}
      >
        {/* 面板 - 紧凑布局，内容区可滚动 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: panelAnimY, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: panelAnimY, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`absolute w-85 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-2xl backdrop-blur-xl ${panelOrigin} flex flex-col`}
              style={{ ...panelPositionStyle, maxHeight: panelMaxHeight }}
            >
              {songsLoading ? (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-1.5 rounded-full bg-muted animate-pulse" />
                    <div className="flex justify-between">
                      <div className="h-2 w-6 rounded bg-muted animate-pulse" />
                      <div className="h-2 w-6 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <div className="size-8 rounded-full bg-muted animate-pulse" />
                    <div className="size-10 rounded-full bg-muted animate-pulse" />
                    <div className="size-8 rounded-full bg-muted animate-pulse" />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-2.5 px-2">
                        <div className="size-8 rounded bg-muted animate-pulse" />
                        <div className="flex-1 space-y-1.5">
                          <div
                            className="h-3 rounded bg-muted animate-pulse"
                            style={{ width: `${60 + Math.random() * 30}%` }}
                          />
                          <div className="h-2 w-1/3 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : songs.length === 0 ? (
                <div className="relative py-12 text-center text-sm text-muted-foreground">
                  <button
                    onClick={() => setExpanded(false)}
                    className="absolute right-3 top-3 rounded-md p-1.5 transition-colors hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  歌单暂无歌曲
                </div>
              ) : (
                currentSong && (
                  <>
                    {/* 歌曲信息 + 关闭 */}
                    <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 shrink-0">
                      <motion.div
                        layoutId="vinyl-disc"
                        className="size-10 shrink-0 overflow-hidden rounded-lg shadow-sm"
                      >
                        <img
                          src={currentSong.cover}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </motion.div>
                      <div className="min-w-0 flex-1">
                        <MarqueeText className="text-sm font-medium leading-tight">
                          {currentSong.name}
                        </MarqueeText>
                        <MarqueeText className="text-xs text-muted-foreground">
                          {currentSong.artist}
                        </MarqueeText>
                      </div>
                      {playlists.length > 1 && (
                        <button
                          onClick={() => setShowPlaylist(!showPlaylist)}
                          className={`max-w-24 shrink-0 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted ${
                            showPlaylist ? "bg-muted" : ""
                          }`}
                        >
                          <MarqueeText className="text-xs">
                            {currentPlaylist?.title || ""}
                          </MarqueeText>
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(false)}
                        className="shrink-0 rounded-md p-1.5 transition-colors hover:bg-muted"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 歌单选择器 */}
                    <AnimatePresence>
                      {showPlaylist && playlists.length > 1 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden shrink-0"
                        >
                          <div className="grid grid-cols-2 gap-1.5 px-3 py-2">
                            {playlists.map((playlist, index) => (
                              <button
                                key={playlist.id}
                                onClick={() => handleSwitchPlaylist(index)}
                                disabled={songsLoading}
                                className={`rounded-lg px-3 py-2 text-xs text-center transition-all ${
                                  index === currentPlaylistIndex
                                    ? "bg-foreground text-background font-medium"
                                    : "bg-muted/60 hover:bg-muted"
                                }`}
                              >
                                {playlist.title}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 进度条 */}
                    <div className="px-4 pt-3 pb-1 shrink-0">
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* 播放控制 + 音量 */}
                    <div className="flex items-center justify-between px-4 py-3 shrink-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={playPrev}
                          className="group rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <SkipBack className="h-4 w-4 transition-transform group-hover:scale-110" />
                        </button>
                        <button
                          onClick={togglePlay}
                          className="rounded-full bg-foreground p-2.5 text-background shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                          {isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="ml-0.5 h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={playNext}
                          className="group rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <SkipForward className="h-4 w-4 transition-transform group-hover:scale-110" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMute}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="h-3.5 w-3.5" />
                          ) : (
                            <Volume2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                        />
                      </div>
                    </div>

                    {/* 标签栏 - pill 风格 */}
                    <div className="flex gap-1 px-3 pb-2 shrink-0">
                      <button
                        onClick={() => setPanelView("list")}
                        className={`flex-1 rounded-lg py-1.5 text-center text-xs transition-all ${
                          panelView === "list"
                            ? "bg-foreground text-background font-medium"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        列表 {songs.length}
                      </button>
                      <button
                        onClick={() => setPanelView("lyrics")}
                        className={`flex-1 rounded-lg py-1.5 text-center text-xs transition-all ${
                          panelView === "lyrics"
                            ? "bg-foreground text-background font-medium"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        歌词
                      </button>
                    </div>

                    {/* 可滚动内容区 */}
                    <div
                      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none"
                      style={{ scrollbarWidth: "none" }}
                    >
                      {panelView === "list" ? (
                        <div
                          ref={songListRef}
                          className="px-2 pb-2 space-y-0.5"
                        >
                          {songs.map((song, index) => (
                            <button
                              key={song.id}
                              data-active={
                                index === currentSongIndex || undefined
                              }
                              onClick={() => handleSongClick(index)}
                              className={`group w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                                index === currentSongIndex
                                  ? "bg-primary/10"
                                  : "hover:bg-muted/60"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="relative size-8 shrink-0 overflow-hidden rounded">
                                  {song.cover ? (
                                    <img
                                      src={song.cover}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-muted">
                                      <Music className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  )}
                                  {index === currentSongIndex && isPlaying && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <div className="flex items-end gap-0.5 h-3">
                                        <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate]" />
                                        <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate_0.2s]" />
                                        <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate_0.4s]" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <MarqueeText
                                    className={`text-sm leading-tight ${
                                      index === currentSongIndex
                                        ? "font-medium text-primary"
                                        : ""
                                    }`}
                                  >
                                    {song.name}
                                  </MarqueeText>
                                  <MarqueeText className="text-[10px] text-muted-foreground mt-0.5">
                                    {song.artist}
                                  </MarqueeText>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div ref={lyricsContainerRef} className="py-3">
                          {lyrics.length > 0 ? (
                            lyrics.map((line, index) => {
                              const distance = Math.abs(
                                index - currentLyricIndex
                              );
                              return (
                                <p
                                  key={index}
                                  data-active={
                                    index === currentLyricIndex || undefined
                                  }
                                  className={`px-5 py-1.5 text-center transition-all duration-300 ${
                                    index === currentLyricIndex
                                      ? "text-base font-semibold text-foreground"
                                      : distance <= 2
                                        ? "text-sm text-muted-foreground/70"
                                        : "text-xs text-muted-foreground/40"
                                  }`}
                                >
                                  {line.text}
                                </p>
                              );
                            })
                          ) : (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                              暂无歌词
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 迷你碟片 - 展开时隐藏 */}
        <AnimatePresence>
          {!expanded && (
            <motion.button
              key="mini-disc"
              layoutId="vinyl-disc"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              onClick={() => {
                if (!hasMovedRef.current) setExpanded(true);
              }}
              transition={{ duration: 0.15 }}
              className={`cursor-grab active:cursor-grabbing ${isDragging ? "select-none" : ""}`}
            >
              <VinylDisc
                cover={currentSong?.cover}
                isPlaying={isPlaying}
                size={52}
              />

              {isPlaying && (
                <div className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500 animate-pulse" />
              )}

              {currentSong && !isDragging && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-1/2 top-full mt-2 -translate-x-1/2"
                >
                  <p className="max-w-30 truncate text-center text-xs text-muted-foreground">
                    {currentSong.name}
                  </p>
                </motion.div>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
