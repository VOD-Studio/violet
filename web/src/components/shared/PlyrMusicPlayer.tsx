/**
 * Plyr 音乐播放器组件
 * 功能：
 * - 多歌单支持，点击切换歌单
 * - 歌曲列表播放
 * - 播放控制（播放/暂停、上一首/下一首）
 * - 音量控制
 * - 进度条
 * - 可拖拽按钮（带边界约束）
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
  ChevronUp,
  ChevronDown,
  Loader2,
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

/** 使用 Meting API 获取歌曲列表 */
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
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        return data.map((song: any, index: number) => ({
          id: song.id || `${server}-${id}-${index}`,
          name: song.name || song.title || "未知歌曲",
          artist: song.artist || "未知艺术家",
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

interface PlyrMusicPlayerProps {
  playlists: Playlist[];
}

/**
 * Plyr 音乐播放器组件
 */
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
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 拖拽状态 - 使用 ref 来避免重渲染问题
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    hasMoved: false,
  });

  // 计算面板位置 - 确保不遮挡按钮
  const calculatePanelPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const panelWidth = 320;
    const panelEstHeight = 450;
    const gap = 20;

    let left = buttonRect.right - panelWidth;
    if (left < 8) left = 8;
    if (left + panelWidth > window.innerWidth - 8) {
      left = window.innerWidth - panelWidth - 8;
    }

    const screenHeight = window.innerHeight;
    const spaceAbove = buttonRect.top - gap;
    const spaceBelow = screenHeight - buttonRect.bottom - gap;

    let top: number;

    if (spaceAbove >= panelEstHeight) {
      top = buttonRect.top - panelEstHeight - gap;
    } else if (spaceBelow >= panelEstHeight) {
      top = buttonRect.bottom + gap;
    } else if (spaceAbove > spaceBelow) {
      top = 8;
    } else {
      top = screenHeight - panelEstHeight - 8;
    }

    setPanelPosition({ top, left });
  }, []);

  // 拖拽开始
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStateRef.current = {
      isDragging: true,
      startX: clientX,
      startY: clientY,
      startLeft: rect.left,
      startTop: rect.top,
      hasMoved: false,
    };
  }, []);

  // 拖拽移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragStateRef.current.isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragStateRef.current.startX;
    const deltaY = clientY - dragStateRef.current.startY;

    // 如果移动超过 5px，认为是在拖拽而非点击
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      dragStateRef.current.hasMoved = true;
    }

    // 计算新位置并约束边界
    const buttonWidth = 120;
    const buttonHeight = 44;
    const padding = 8;

    let newLeft = dragStateRef.current.startLeft + deltaX;
    let newTop = dragStateRef.current.startTop + deltaY;

    // 边界约束
    newLeft = Math.max(padding, Math.min(newLeft, window.innerWidth - buttonWidth - padding));
    newTop = Math.max(padding, Math.min(newTop, window.innerHeight - buttonHeight - padding));

    // 更新按钮位置
    if (buttonRef.current) {
      buttonRef.current.style.left = `${newLeft}px`;
      buttonRef.current.style.top = `${newTop}px`;
      buttonRef.current.style.right = 'auto';
      buttonRef.current.style.bottom = 'auto';
    }
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!dragStateRef.current.isDragging) return;

    dragStateRef.current.isDragging = false;

    // 如果发生了实际移动，更新面板位置
    if (dragStateRef.current.hasMoved) {
      calculatePanelPosition();
    }
  }, [calculatePanelPosition]);

  // 处理点击（区分点击和拖拽）
  const handleButtonClick = useCallback(() => {
    // 如果刚拖拽过，不触发点击
    if (dragStateRef.current.hasMoved) {
      dragStateRef.current.hasMoved = false;
      return;
    }
    setExpanded(!expanded);
  }, [expanded]);

  // 绑定全局拖拽事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleTouchEnd = () => handleDragEnd();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const currentPlaylist = playlists[currentPlaylistIndex];
  const currentSong = songs[currentSongIndex] || null;

  // 加载当前歌单的歌曲
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
      } catch (error) {
        console.error("Failed to load songs:", error);
      } finally {
        setSongsLoading(false);
      }
    }

    loadSongs();
  }, [currentPlaylist]);

  // 初始化音频事件监听
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (currentSongIndex < songs.length - 1) {
        setCurrentSongIndex((prev) => prev + 1);
      } else {
        setCurrentSongIndex(0);
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentSongIndex, songs.length]);

  // 处理播放/暂停
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  }, [isPlaying, currentSong]);

  // 上一首
  const playPrev = useCallback(() => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev > 0 ? prev - 1 : songs.length - 1));
  }, [songs.length]);

  // 下一首
  const playNext = useCallback(() => {
    if (songs.length === 0) return;
    setCurrentSongIndex((prev) => (prev < songs.length - 1 ? prev + 1 : 0));
  }, [songs.length]);

  // 音量控制
  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
      if (newVolume > 0) setIsMuted(false);
    },
    []
  );

  // 静音切换
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.muted = newMuted;
  }, [isMuted]);

  // 进度条控制
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  // 格式化时间
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // 切换歌曲时加载
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    audio.src = currentSong.url;
    audio.load();

    if (isPlaying) {
      audio.play().catch(console.error);
    }
  }, [currentSong]);

  // 切换歌单
  const handleSwitchPlaylist = useCallback(
    (index: number) => {
      if (index === currentPlaylistIndex) return;
      setCurrentPlaylistIndex(index);
      setShowPlaylistPanel(false);
    },
    [currentPlaylistIndex]
  );

  // 展开/收起时计算面板位置
  useEffect(() => {
    if (expanded) {
      calculatePanelPosition();
    }
  }, [expanded, calculatePanelPosition]);

  return (
    <>
      {/* 可拖拽的悬浮按钮 */}
      <div
        ref={buttonRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onClick={handleButtonClick}
        className="fixed right-4 z-60 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ bottom: "13rem" }}
      >
        <button
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full shadow-lg transition-colors"
        >
          {songsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : isPlaying ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Play className="h-4 w-4" />
            </motion.div>
          ) : (
            <Music className="h-4 w-4 shrink-0" />
          )}

          <AnimatePresence mode="wait">
            <motion.span
              key={expanded ? "collapse" : currentPlaylist?.title || "music"}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium truncate overflow-hidden hidden sm:block"
            >
              {expanded
                ? "收起"
                : songsLoading
                  ? "加载中"
                  : currentPlaylist?.title || "音乐"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      {/* 播放器面板 - 智能定位 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed z-50 bg-background/95 backdrop-blur rounded-2xl shadow-xl overflow-auto"
            style={{
              width: "320px",
              maxWidth: "calc(100vw - 16px)",
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
              maxHeight: "calc(100vh - 16px)",
            }}
          >
            <audio ref={audioRef} preload="metadata" />

            {/* 关闭按钮 */}
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 right-2 p-1 rounded-full bg-muted/50 hover:bg-muted transition-colors z-10"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* 歌单标题 */}
            <div className="p-3 bg-primary/5 border-b border-border/50">
              <p className="text-sm font-medium truncate">
                {currentPlaylist?.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {songs.length} 首歌曲
              </p>
            </div>

            {/* 歌单切换 */}
            {playlists.length > 1 && (
              <div className="border-b border-border/50">
                <button
                  onClick={() => setShowPlaylistPanel(!showPlaylistPanel)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-4 w-4" />
                    <span className="text-sm">切换歌单</span>
                  </div>
                  {showPlaylistPanel ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                <AnimatePresence>
                  {showPlaylistPanel && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2 pb-2 space-y-1">
                        {playlists.map((playlist, index) => (
                          <button
                            key={playlist.id}
                            onClick={() => handleSwitchPlaylist(index)}
                            disabled={songsLoading}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              index === currentPlaylistIndex
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            } ${songsLoading ? "opacity-50 cursor-not-allowed" : ""}`}
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

            {/* 加载中 */}
            {songsLoading && (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* 无歌曲 */}
            {!songsLoading && songs.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                歌单暂无歌曲
              </div>
            )}

            {/* 有歌曲时显示播放器 */}
            {!songsLoading && songs.length > 0 && currentSong && (
              <>
                {/* 当前歌曲信息 */}
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    {currentSong.cover && (
                      <motion.img
                        key={currentSong.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        src={currentSong.cover}
                        alt={currentSong.name}
                        className="w-12 h-12 rounded-lg object-cover shadow-md"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {currentSong.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {currentSong.artist}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="px-4 py-3 border-b border-border/50">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="p-4 flex items-center justify-center gap-6 border-b border-border/50">
                  <button
                    onClick={playPrev}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="p-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={playNext}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                </div>

                {/* 音量控制 */}
                <div className="px-4 py-2 flex items-center gap-2 border-b border-border/50">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded hover:bg-muted transition-colors"
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
                    className="flex-1 h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* 歌曲列表 */}
                <div className="max-h-48 overflow-y-auto">
                  {songs.map((song, index) => (
                    <button
                      key={song.id}
                      onClick={() => setCurrentSongIndex(index)}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        index === currentSongIndex
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 text-xs text-muted-foreground">
                          {index === currentSongIndex && isPlaying ? (
                            <Play className="h-3 w-3 inline" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`truncate ${index === currentSongIndex ? "text-primary font-medium" : ""}`}
                          >
                            {song.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {song.artist}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}