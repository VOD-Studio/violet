/**
 * 播放控制按钮组件
 * 包含上一首、播放/暂停、下一首按钮
 */

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

/** PlayerControls 组件的属性 */
interface PlayerControlsProps {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 切换播放/暂停回调 */
  onTogglePlay: () => void;
  /** 上一首回调 */
  onPlayPrev: () => void;
  /** 下一首回调 */
  onPlayNext: () => void;
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onPlayPrev,
  onPlayNext,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onPlayPrev}
        className="group rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SkipBack className="h-4 w-4 transition-transform group-hover:scale-110" />
      </button>
      <button
        onClick={onTogglePlay}
        className="rounded-full bg-foreground p-2.5 text-background shadow-md transition-all hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>
      <button
        onClick={onPlayNext}
        className="group rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SkipForward className="h-4 w-4 transition-transform group-hover:scale-110" />
      </button>
    </div>
  );
}
