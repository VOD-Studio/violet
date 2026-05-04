/**
 * 音量控制组件
 * 包含静音按钮和音量滑块
 */

import { Volume2, VolumeX } from "lucide-react";

interface PlayerVolumeProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleMute: () => void;
}

export function PlayerVolume({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: PlayerVolumeProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMute}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="h-3.5 w-3.5" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={onVolumeChange}
        className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  );
}
