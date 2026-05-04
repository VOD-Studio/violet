import { useCallback } from "react";
import type { PlayMode, PlayerState } from "../types";

export function usePlayMode(
  state: PlayerState,
  setState: React.Dispatch<React.SetStateAction<PlayerState>>
) {
  const togglePlayMode = useCallback(() => {
    const modes: PlayMode[] = ["sequence", "loop", "single", "shuffle"];
    const currentModeIndex = modes.indexOf(state.playMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setState((prev) => ({ ...prev, playMode: nextMode }));
  }, [state.playMode, setState]);

  return { togglePlayMode };
}
