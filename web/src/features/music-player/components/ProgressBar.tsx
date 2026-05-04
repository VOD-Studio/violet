import { formatTime } from "../utils/formatTime";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (value: number) => void;
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-10 text-xs text-muted-foreground text-right">
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 h-1 accent-primary"
      />
      <span className="w-10 text-xs text-muted-foreground">
        {formatTime(duration)}
      </span>
    </div>
  );
}
