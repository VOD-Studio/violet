/**
 * 音乐播放器组件
 * 支持网易云/QQ音乐歌单导入和播放
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 歌曲信息 */
export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  url: string;
  platform: string;
}

/** 歌单信息 */
export interface PlaylistInfo {
  id: string;
  title: string;
  cover: string;
  creator: string;
  count: number;
  platform: string;
  songs: SongInfo[];
}

/** 播放模式 */
type PlayMode = "sequence" | "loop" | "single" | "shuffle";

/** 播放器状态 */
interface PlayerState {
  currentSong: SongInfo | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  playlist: SongInfo[];
}

/** 播放器组件属性 */
interface MusicPlayerProps {
  /** 歌单数据 */
  playlist: SongInfo[];
  /** 自定义类名 */
  className?: string;
  /** 播放结束回调 */
  onEnded?: () => void;
}

/**
 * 格式化时间
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 音乐播放器组件
 */
export function MusicPlayer({ playlist, className, onEnded }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.7,
    playMode: "sequence",
    playlist: [],
  });

  // 初始化歌单
  useEffect(() => {
    if (playlist.length > 0 && state.playlist.length === 0) {
      setState((prev) => ({
        ...prev,
        playlist,
        currentSong: playlist[0],
        currentIndex: 0,
      }));
    }
  }, [playlist]);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !state.currentSong) return;

    if (state.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        // 播放失败，可能是 CORS 问题
      });
    }
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [state.isPlaying, state.currentSong]);

  // 切换歌曲
  const changeSong = useCallback(
    (index: number) => {
      const song = state.playlist[index];
      if (!song) return;

      setState((prev) => ({
        ...prev,
        currentSong: song,
        currentIndex: index,
        currentTime: 0,
        isPlaying: true,
      }));

      if (audioRef.current) {
        audioRef.current.src = song.url;
        audioRef.current.play().catch(() => {});
      }
    },
    [state.playlist]
  );

  // 上一首
  const prevSong = useCallback(() => {
    let newIndex = state.currentIndex - 1;
    if (newIndex < 0) {
      newIndex = state.playlist.length - 1;
    }
    changeSong(newIndex);
  }, [state.currentIndex, state.playlist.length, changeSong]);

  // 下一首
  const nextSong = useCallback(() => {
    let newIndex: number;
    const { playMode, currentIndex, playlist } = state;

    if (playMode === "shuffle") {
      newIndex = Math.floor(Math.random() * playlist.length);
    } else {
      newIndex = currentIndex + 1;
      if (newIndex >= playlist.length) {
        newIndex = 0;
      }
    }
    changeSong(newIndex);
  }, [state, changeSong]);

  // 切换播放模式
  const togglePlayMode = useCallback(() => {
    const modes: PlayMode[] = ["sequence", "loop", "single", "shuffle"];
    const currentModeIndex = modes.indexOf(state.playMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setState((prev) => ({ ...prev, playMode: nextMode }));
  }, [state.playMode]);

  // 音量控制
  const changeVolume = useCallback((value: number) => {
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
    setState((prev) => ({ ...prev, volume: value }));
  }, []);

  // 进度控制
  const seekTo = useCallback((value: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
    setState((prev) => ({ ...prev, currentTime: value }));
  }, []);

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
      }));
    };

    const handleEnded = () => {
      if (state.playMode === "single") {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextSong();
      }
      onEnded?.();
    };

    const handleLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        duration: audio.duration,
      }));
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [state.playMode, nextSong, onEnded]);

  // 设置初始音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, []);

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <audio ref={audioRef} src={state.currentSong?.url} preload="metadata" />

      {/* 当前歌曲信息 */}
      {state.currentSong && (
        <div className="flex items-center gap-4 mb-4">
          <img
            src={state.currentSong.cover}
            alt={state.currentSong.album}
            className="size-12 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{state.currentSong.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {state.currentSong.artist}
            </p>
          </div>
        </div>
      )}

      {/* 进度条 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-10 text-xs text-muted-foreground text-right">
          {formatTime(state.currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={state.duration || 100}
          value={state.currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="flex-1 h-1 accent-primary"
        />
        <span className="w-10 text-xs text-muted-foreground">
          {formatTime(state.duration)}
        </span>
      </div>

      {/* 播放控制 */}
      <div className="flex items-center justify-between">
        {/* 左侧：播放模式 */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayMode}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title={
              state.playMode === "sequence"
                ? "顺序播放"
                : state.playMode === "loop"
                  ? "列表循环"
                  : state.playMode === "single"
                    ? "单曲循环"
                    : "随机播放"
            }
          >
            {state.playMode === "shuffle" ? (
              <Shuffle className="size-4" />
            ) : state.playMode === "single" ? (
              <Repeat1 className="size-4" />
            ) : (
              <Repeat className="size-4" />
            )}
          </button>
        </div>

        {/* 中间：播放控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevSong}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <SkipBack className="size-5" />
          </button>
          <button
            onClick={togglePlay}
            className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {state.isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5" />
            )}
          </button>
          <button
            onClick={nextSong}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <SkipForward className="size-5" />
          </button>
        </div>

        {/* 右侧：音量控制 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeVolume(state.volume > 0 ? 0 : 0.7)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            {state.volume > 0 ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="w-20 h-1 accent-primary"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * 歌曲列表组件
 */
export function SongList({
  songs,
  currentIndex,
  onSelect,
}: {
  songs: SongInfo[];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="space-y-1">
      {songs.map((song, index) => (
        <button
          key={`${song.platform}-${song.id}`}
          onClick={() => onSelect(index)}
          className={cn(
            "flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left",
            index === currentIndex
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          )}
        >
          <span className="w-6 text-center text-xs text-muted-foreground">
            {index + 1}
          </span>
          <img
            src={song.cover}
            alt={song.album}
            className="size-8 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{song.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {song.artist}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTime(song.duration)}
          </span>
        </button>
      ))}
    </div>
  );
}