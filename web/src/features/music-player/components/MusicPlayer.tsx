import { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePlayerState } from "../hooks/usePlayerState";
import { usePlayMode } from "../hooks/usePlayMode";
import { useAudioEvents } from "../hooks/useAudioEvents";
import { PlayerInfo } from "./PlayerInfo";
import { ProgressBar } from "./ProgressBar";
import { PlayControls } from "./PlayControls";
import { VolumeControl } from "./VolumeControl";
import { PlayModeButton } from "./PlayModeButton";
import type { MusicPlayerProps } from "../types";

export function MusicPlayer({ playlist, className, onEnded }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = usePlayerState(playlist);
  const { togglePlayMode } = usePlayMode(state, setState);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !state.currentSong) return;

    if (state.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [state.isPlaying, state.currentSong, setState]);

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
    [state.playlist, setState]
  );

  const prevSong = useCallback(() => {
    let newIndex = state.currentIndex - 1;
    if (newIndex < 0) {
      newIndex = state.playlist.length - 1;
    }
    changeSong(newIndex);
  }, [state.currentIndex, state.playlist.length, changeSong]);

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

  const changeVolume = useCallback(
    (value: number) => {
      if (audioRef.current) {
        audioRef.current.volume = value;
      }
      setState((prev) => ({ ...prev, volume: value }));
    },
    [setState]
  );

  const seekTo = useCallback(
    (value: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = value;
      }
      setState((prev) => ({ ...prev, currentTime: value }));
    },
    [setState]
  );

  useAudioEvents(audioRef, state, setState, nextSong, onEnded);

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <audio ref={audioRef} src={state.currentSong?.url} preload="metadata" />

      {state.currentSong && <PlayerInfo song={state.currentSong} />}

      <ProgressBar
        currentTime={state.currentTime}
        duration={state.duration}
        onSeek={seekTo}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlayModeButton playMode={state.playMode} onToggle={togglePlayMode} />
        </div>

        <PlayControls
          isPlaying={state.isPlaying}
          onTogglePlay={togglePlay}
          onPrev={prevSong}
          onNext={nextSong}
        />

        <VolumeControl volume={state.volume} onVolumeChange={changeVolume} />
      </div>
    </div>
  );
}
