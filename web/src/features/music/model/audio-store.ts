import { create } from "zustand";
import type { Song } from "./types";

export interface AudioState {
    isPlaying: boolean;
    currentTrack: Song | null;
    play: () => void;
    pause: () => void;
    toggle: () => void;
    setTrack: (track: Song) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
    isPlaying: false,
    currentTrack: null,
    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
    setTrack: (track) => set({ currentTrack: track }),
}));
