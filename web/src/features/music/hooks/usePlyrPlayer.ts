/**
 * 播放器逻辑 Hook
 * 管理音频播放状态、歌曲切换、音量控制等核心逻辑
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getUploadUrl } from "@/lib/api";

/** 歌曲信息 */
export interface Song {
  id: string;
  name: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
}

/** 后端歌曲数据格式 */
export interface SongData {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover?: string;
  lrc?: string;
}

/** 歌单信息（后端返回格式） */
export interface Playlist {
  id: string;
  title: string;
  cover?: string;
  creator?: string;
  platform: string;
  playlist_id: string;
  song_count: number;
  songs: SongData[];
  is_active: boolean;
}

export function usePlyrPlayer(playlists: Playlist[]) {
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyricsText, setLyricsText] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const songsLengthRef = useRef(songs.length);
  songsLengthRef.current = songs.length;
  const skipPauseRef = useRef(false);
  const stopAfterLoadRef = useRef(false);
  const errorCountRef = useRef(0);
  const shouldAutoPlayRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const currentPlaylist = playlists[currentPlaylistIndex];
  const currentSong = songs[currentSongIndex] || null;

  // 加载歌单歌曲
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

  // 解析歌词文本
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

  // 音频事件监听
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
        skipPauseRef.current = false;
        setIsPlaying(false);
        return;
      }
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

  const handleSwitchPlaylist = useCallback(
    (index: number) => {
      if (index === currentPlaylistIndex) return;
      setCurrentPlaylistIndex(index);
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

  return {
    // State
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
    // Refs
    audioRef,
    // Actions
    togglePlay,
    playPrev,
    playNext,
    handleVolumeChange,
    toggleMute,
    handleSeek,
    handleSwitchPlaylist,
    handleSongClick,
  };
}
