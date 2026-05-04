import { cn } from "@/lib/utils";
import { formatTime } from "../utils/formatTime";
import type { SongInfo } from "../types";

interface SongListProps {
  songs: SongInfo[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function SongList({ songs, currentIndex, onSelect }: SongListProps) {
  return (
    <div className="space-y-1">
      {songs.map((song, index) => (
        <button
          key={`${song.platform}-${song.id}`}
          onClick={() => onSelect(index)}
          className={cn(
            "flex items-center gap-3 w-full p-2 rounded-lg transition-colors text-left",
            index === currentIndex
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          )}
        >
          <span className="w-6 text-center text-xs text-muted-foreground">
            {index + 1}
          </span>
          <img
            src={song.cover}
            alt={song.album}
            className="size-8 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{song.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {song.artist}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTime(song.duration)}
          </span>
        </button>
      ))}
    </div>
  );
}
