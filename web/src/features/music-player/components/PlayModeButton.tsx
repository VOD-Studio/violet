import { Repeat, Repeat1, Shuffle } from "lucide-react";
import type { PlayMode } from "../types";

interface PlayModeButtonProps {
  playMode: PlayMode;
  onToggle: () => void;
}

export function PlayModeButton({ playMode, onToggle }: PlayModeButtonProps) {
  const getTitle = () => {
    switch (playMode) {
      case "sequence":
        return "顺序播放";
      case "loop":
        return "列表循环";
      case "single":
        return "单曲循环";
      case "shuffle":
        return "随机播放";
    }
  };

  const getIcon = () => {
    switch (playMode) {
      case "shuffle":
        return <Shuffle className="size-4" />;
      case "single":
        return <Repeat1 className="size-4" />;
      default:
        return <Repeat className="size-4" />;
    }
  };

  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-full hover:bg-muted transition-colors"
      title={getTitle()}
    >
      {getIcon()}
    </button>
  );
}
