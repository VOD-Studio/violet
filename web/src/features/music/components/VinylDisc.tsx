/**
 * 唱片碟片组件
 * 显示旋转的唱片效果
 */

import { Music } from "lucide-react";

interface VinylDiscProps {
  cover?: string;
  isPlaying: boolean;
  size: number;
}

export function VinylDisc({ cover, isPlaying, size }: VinylDiscProps) {
  const coverSize = size * 0.55;
  const holeSize = Math.max(size * 0.06, 4);

  return (
    <div
      className="relative rounded-full bg-linear-to-br from-gray-700 to-gray-900 shadow-lg ring-2 ring-white/10"
      style={{
        width: size,
        height: size,
        animation: "music-disc-spin 8s linear infinite",
        animationPlayState: isPlaying ? "running" : "paused",
      }}
    >
      <div
        className="absolute inset-0 rounded-full opacity-[0.08]"
        style={{
          background:
            "repeating-radial-gradient(circle, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 4px)",
        }}
      />

      <div
        className="absolute rounded-full overflow-hidden ring-1 ring-white/10"
        style={{
          width: coverSize,
          height: coverSize,
          top: (size - coverSize) / 2,
          left: (size - coverSize) / 2,
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/30 to-primary/60">
            <Music
              className="text-white"
              style={{ width: size * 0.18, height: size * 0.18 }}
            />
          </div>
        )}
      </div>

      <div
        className="absolute z-10 rounded-full bg-gray-800"
        style={{
          width: holeSize,
          height: holeSize,
          top: (size - holeSize) / 2,
          left: (size - holeSize) / 2,
        }}
      />
    </div>
  );
}
