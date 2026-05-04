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
import { X, ChevronDown } from "lucide-react";
import { usePlyrPlayer, type Playlist } from "../hooks/usePlyrPlayer";
import { VinylDisc } from "./VinylDisc";
import { MarqueeText } from "./MarqueeText";
import { PlayerProgress } from "./PlayerProgress";
import { PlayerControls } from "./PlayerControls";
import { PlayerVolume } from "./PlayerVolume";
import { PlayerPlaylist } from "./PlayerPlaylist";

interface PlyrMusicPlayerProps {
  playlists: Playlist[];
}

export function PlyrMusicPlayer({ playlists }: PlyrMusicPlayerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [panelView, setPanelView] = useState<"list" | "lyrics">("list");
  const [position, setPosition] = useState({ right: 16, bottom: 240 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posRight: 0, posBottom: 0 });
  const hasMovedRef = useRef(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const {
    currentPlaylistIndex,
    currentPlaylist,
    songs,
    songsLoading,
    currentSongIndex,
    currentSong,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    duration,
    lyricsText,
    audioRef,
    togglePlay,
    playPrev,
    playNext,
    handleVolumeChange,
    toggleMute,
    handleSeek,
    handleSwitchPlaylist,
    handleSongClick,
  } = usePlyrPlayer(playlists);

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

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMovedRef.current = true;
      }

      const playerWidth = playerRef.current?.offsetWidth || 52;
      const playerHeight = playerRef.current?.offsetHeight || 52;

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleDragStart(e.clientX, e.clientY);
    },
    [handleDragStart]
  );

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

  const handleSwitchPlaylistInternal = useCallback(
    (index: number) => {
      handleSwitchPlaylist(index);
      setShowPlaylist(false);
    },
    [handleSwitchPlaylist]
  );

  // 面板边界处理
  const padding = 16;
  const panelWidth = 340;
  const spaceAbove = window.innerHeight - position.bottom;
  const spaceBelow = position.bottom;
  const expandDown = spaceAbove < 450;
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
        {/* 面板 */}
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
                                onClick={() =>
                                  handleSwitchPlaylistInternal(index)
                                }
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
                    <PlayerProgress
                      currentTime={currentTime}
                      duration={duration}
                      onSeek={handleSeek}
                    />

                    {/* 播放控制 + 音量 */}
                    <div className="flex items-center justify-between px-4 py-3 shrink-0">
                      <PlayerControls
                        isPlaying={isPlaying}
                        onTogglePlay={togglePlay}
                        onPlayPrev={playPrev}
                        onPlayNext={playNext}
                      />
                      <PlayerVolume
                        volume={volume}
                        isMuted={isMuted}
                        onVolumeChange={handleVolumeChange}
                        onToggleMute={toggleMute}
                      />
                    </div>

                    {/* 播放列表和歌词 */}
                    <PlayerPlaylist
                      songs={songs}
                      currentSongIndex={currentSongIndex}
                      isPlaying={isPlaying}
                      panelView={panelView}
                      lyricsText={lyricsText}
                      currentTime={currentTime}
                      expanded={expanded}
                      onSongClick={handleSongClick}
                      onPanelViewChange={setPanelView}
                    />
                  </>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 迷你碟片 */}
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
