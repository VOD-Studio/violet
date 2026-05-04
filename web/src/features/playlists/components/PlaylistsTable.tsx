import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Music, Trash2, CheckCircle, ListMusic } from "lucide-react";
import type { PlaylistItem } from "../types";

interface PlaylistsTableProps {
  playlists: PlaylistItem[];
  togglingId: string | null;
  onToggleActive: (id: string, currentActive: boolean) => void;
  onDelete: (id: string) => void;
  onManageSongs: (playlist: PlaylistItem) => void;
}

export function PlaylistsTable({
  playlists,
  togglingId,
  onToggleActive,
  onDelete,
  onManageSongs,
}: PlaylistsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">封面</TableHead>
          <TableHead>标题</TableHead>
          <TableHead>平台</TableHead>
          <TableHead className="w-20">歌曲数</TableHead>
          <TableHead className="w-24">状态</TableHead>
          <TableHead className="w-20">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {playlists.map((playlist) => (
          <TableRow key={playlist.id}>
            <TableCell>
              {playlist.cover ? (
                <img
                  src={playlist.cover}
                  alt={playlist.title}
                  className="size-10 rounded object-cover"
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded bg-muted">
                  <Music className="size-4 text-muted-foreground" />
                </div>
              )}
            </TableCell>
            <TableCell>
              <div>
                <p className="font-medium">{playlist.title}</p>
                <p className="text-xs text-muted-foreground">
                  {playlist.creator}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {playlist.platform === "netease"
                  ? "网易云"
                  : playlist.platform === "tencent"
                    ? "QQ音乐"
                    : "自定义"}
              </Badge>
            </TableCell>
            <TableCell className="text-center">{playlist.song_count}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Switch
                  checked={playlist.is_active}
                  onCheckedChange={() =>
                    onToggleActive(playlist.id, playlist.is_active)
                  }
                  loading={togglingId === playlist.id}
                  disabled={togglingId === playlist.id}
                />
                {playlist.is_active && (
                  <CheckCircle className="size-4 text-green-500" />
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                {playlist.platform === "custom" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onManageSongs(playlist)}
                    title="管理歌曲"
                  >
                    <ListMusic className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onDelete(playlist.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
