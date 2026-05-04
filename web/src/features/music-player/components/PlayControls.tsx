import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface PlayControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function PlayControls({
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
}: PlayControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-2 rounded-full hover:bg-muted transition-colors"
      >
        <SkipBack className="size-5" />
      </button>
      <button
        onClick={onTogglePlay}
        className="p-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button
        onClick={onNext}
        className="p-2 rounded-full hover:bg-muted transition-colors"
      >
        <SkipForward className="size-5" />
      </button>
    </div>
  );
}
