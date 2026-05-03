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
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  ChevronDown,
  Loader2,
  FileText,
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
  server: string;
  playlistId: string;
  type: string;
  isActive: boolean;
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

/** 使用 Meting API 获取歌曲列表（过滤无效 URL） */
async function fetchMetingSongs(
  server: string,
  type: string,
  id: string
): Promise<Song[]> {
  const apiUrls = [
    "https://api.injahow.cn/meting/",
    "https://api.meting.js.org",
    "https://api.i-meto.com/meting/api",
  ];

  for (const apiUrl of apiUrls) {
    try {
      const url = `${apiUrl}?server=${server}&type=${type}&id=${id}`;
      const response = await fetch(url);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        return data
          .map((song: any, index: number) => ({
            id: song.id || `${server}-${id}-${index}`,
            name: song.name || song.title || "未知歌曲",
            artist: song.artist || "未知艺术家",
            url: song.url,
            cover: song.pic || song.cover,
            lrc: song.lrc,
          }))
          .filter((song: Song) => song.url && song.url.startsWith("http"));
      }
    } catch (e) {
      console.warn(`Meting API ${apiUrl} failed:`, e);
    }
  }

  return [];
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
      className="relative rounded-full bg-gradient-to-br from-gray-700 to-gray-900 shadow-lg ring-2 ring-white/10"
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
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/60">
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

  // 加载歌单歌曲
  useEffect(() => {
    if (!currentPlaylist) return;

    async function loadSongs() {
      setSongsLoading(true);
      setSongs([]);
      setCurrentSongIndex(0);
      setIsPlaying(false);

      try {
        const songsData = await fetchMetingSongs(
          currentPlaylist.server,
          currentPlaylist.type,
          currentPlaylist.playlistId
        );
        setSongs(songsData);
        if (songsData.length > 0) {
          // 只有用户主动切换歌单时才自动播放，初始加载/HMR重载时不自动播放
          shouldAutoPlayRef.current = initialLoadDoneRef.current;
        }
      } catch (error) {
        console.error("加载歌曲失败:", error);
      } finally {
        setSongsLoading(false);
        initialLoadDoneRef.current = true;
      }
    }

    loadSongs();
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
      `}</style>

      <audio ref={audioRef} preload="metadata" />

      <div
        ref={playerRef}
        className="fixed z-50"
        style={{ right: position.right, bottom: position.bottom }}
      >
        {/* 面板 - 绝对定位，根据碟片位置动态决定展开方向 */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: panelAnimY, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: panelAnimY, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`absolute w-85 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-border/50 bg-background/95 shadow-2xl backdrop-blur-xl ${panelOrigin}`}
              style={{ ...panelPositionStyle, maxHeight: panelMaxHeight }}
            >
              {/* 标题栏 */}
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {currentPlaylist?.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {songs.length} 首歌曲
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-full p-1.5 transition-colors hover:bg-muted"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {songsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : songs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  歌单暂无歌曲
                </div>
              ) : (
                currentSong && (
                  <>
                    {/* 唱片 + 歌曲信息 */}
                    <div className="flex items-center gap-4 px-5 pt-5 pb-3">
                      <div className="shrink-0">
                        <motion.div layoutId="vinyl-disc">
                          <VinylDisc
                            cover={currentSong.cover}
                            isPlaying={isPlaying}
                            size={80}
                          />
                        </motion.div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">
                          {currentSong.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {currentSong.artist}
                        </p>
                      </div>
                    </div>

                    {/* 进度条 */}
                    <div className="px-5 py-2">
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* 播放控制 */}
                    <div className="flex items-center justify-center gap-8 py-3">
                      <button
                        onClick={playPrev}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                      >
                        <SkipBack className="h-5 w-5" />
                      </button>
                      <button
                        onClick={togglePlay}
                        className="rounded-full bg-primary p-3.5 text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="ml-0.5 h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={playNext}
                        className="rounded-full p-2 transition-colors hover:bg-muted"
                      >
                        <SkipForward className="h-5 w-5" />
                      </button>
                    </div>

                    {/* 音量控制 */}
                    <div className="flex items-center gap-2 px-5 py-2">
                      <button
                        onClick={toggleMute}
                        className="rounded p-1 transition-colors hover:bg-muted"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                      />
                    </div>

                    {/* 歌单切换 */}
                    {playlists.length > 1 && (
                      <div className="border-t border-border/50">
                        <button
                          onClick={() => setShowPlaylist(!showPlaylist)}
                          className="flex w-full items-center justify-between px-5 py-2.5 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <ListMusic className="h-4 w-4" />
                            <span className="text-sm">切换歌单</span>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${showPlaylist ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence>
                          {showPlaylist && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: "auto" }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-1 px-3 pb-2">
                                {playlists.map((playlist, index) => (
                                  <button
                                    key={playlist.id}
                                    onClick={() => handleSwitchPlaylist(index)}
                                    disabled={songsLoading}
                                    className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                                      index === currentPlaylistIndex
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted"
                                    }`}
                                  >
                                    {playlist.title}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* 列表 / 歌词 切换标签 */}
                    <div className="flex border-t border-border/50">
                      <button
                        onClick={() => setPanelView("list")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                          panelView === "list"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ListMusic className="h-3.5 w-3.5" />
                        列表
                      </button>
                      <button
                        onClick={() => setPanelView("lyrics")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm transition-colors ${
                          panelView === "lyrics"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        歌词
                      </button>
                    </div>

                    {/* 歌曲列表 / 歌词 */}
                    <div className="max-h-40 overflow-y-auto">
                      {panelView === "list" ? (
                        <div ref={songListRef}>
                          {songs.map((song, index) => (
                            <button
                              key={song.id}
                              data-active={
                                index === currentSongIndex || undefined
                              }
                              onClick={() => handleSongClick(index)}
                              className={`w-full px-5 py-2 text-left text-sm transition-colors ${
                                index === currentSongIndex
                                  ? "bg-primary/10"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-5 shrink-0 text-xs text-muted-foreground">
                                  {index === currentSongIndex && isPlaying ? (
                                    <Play className="inline h-3 w-3" />
                                  ) : (
                                    index + 1
                                  )}
                                </span>
                                <p
                                  className={`min-w-0 flex-1 truncate ${
                                    index === currentSongIndex
                                      ? "font-medium text-primary"
                                      : ""
                                  }`}
                                >
                                  {song.name}
                                </p>
                                <span className="max-w-20 truncate text-xs text-muted-foreground">
                                  {song.artist}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div ref={lyricsContainerRef} className="py-2">
                          {lyrics.length > 0 ? (
                            lyrics.map((line, index) => (
                              <p
                                key={index}
                                data-active={
                                  index === currentLyricIndex || undefined
                                }
                                className={`px-5 py-1 text-sm leading-6 transition-colors ${
                                  index === currentLyricIndex
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {line.text}
                              </p>
                            ))
                          ) : (
                            <p className="px-5 py-4 text-center text-sm text-muted-foreground">
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