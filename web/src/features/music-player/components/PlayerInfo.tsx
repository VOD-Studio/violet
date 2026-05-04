import type { SongInfo } from "../types";

interface PlayerInfoProps {
  song: SongInfo;
}

export function PlayerInfo({ song }: PlayerInfoProps) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <img
        src={song.cover}
        alt={song.album}
        className="size-12 rounded object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{song.title}</p>
        <p className="truncate text-sm text-muted-foreground">{song.artist}</p>
      </div>
    </div>
  );
}
