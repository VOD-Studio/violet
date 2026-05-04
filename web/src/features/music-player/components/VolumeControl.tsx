import { Volume2, VolumeX } from "lucide-react";

interface VolumeControlProps {
  volume: number;
  onVolumeChange: (value: number) => void;
}

export function VolumeControl({ volume, onVolumeChange }: VolumeControlProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
        className="p-2 rounded-full hover:bg-muted transition-colors"
      >
        {volume > 0 ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className="w-20 h-1 accent-primary"
      />
    </div>
  );
}
