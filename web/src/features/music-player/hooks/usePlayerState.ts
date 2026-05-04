import { useState, useEffect } from "react";
import type { PlayerState, SongInfo } from "../types";

export function usePlayerState(playlist: SongInfo[]) {
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

  useEffect(() => {
    if (playlist.length > 0 && state.playlist.length === 0) {
      setState((prev) => ({
        ...prev,
        playlist,
        currentSong: playlist[0],
        currentIndex: 0,
      }));
    }
  }, [playlist, state.playlist.length]);

  return [state, setState] as const;
}
