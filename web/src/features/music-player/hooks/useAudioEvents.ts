import { useEffect, type RefObject } from "react";
import type { PlayerState } from "../types";

export function useAudioEvents(
  audioRef: RefObject<HTMLAudioElement | null>,
  state: PlayerState,
  setState: React.Dispatch<React.SetStateAction<PlayerState>>,
  nextSong: () => void,
  onEnded?: () => void
) {
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
  }, [audioRef, state.playMode, setState, nextSong, onEnded]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.volume;
    }
  }, [audioRef, state.volume]);
}
