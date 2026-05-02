/**
 * 音乐歌单管理页面
 * 支持导入网易云/QQ音乐歌单、设置启用、删除
 * 支持切换播放器版本 (v1: APlayer, v2: Plyr)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Link,
  Music,
  Trash2,
  Loader2,
  CheckCircle,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/** 歌单数据 */
interface PlaylistItem {
  id: string;
  title: string;
  cover: string;
  creator: string;
  platform: string;
  playlist_id: string;
  song_count: number;
  is_active: boolean;
  created_at: string;
}

/** 歌单列表响应 */
interface PlaylistListResponse {
  playlists: PlaylistItem[];
  total: number;
}

/** 播放器设置响应 */
interface MusicSettingsResponse {
  settings: {
    player_version: string;
  };
}

/** 获取歌单列表 */
function usePlaylists() {
  return useQuery({
    queryKey: ["admin", "playlists"],
    queryFn: async () => {
      const res = await api.get<PlaylistListResponse>("/admin/playlists");
      return res;
    },
  });
}

/** 获取播放器设置 */
function useMusicSettings() {
  return useQuery({
    queryKey: ["admin", "music-settings"],
    queryFn: async () => {
      const res = await api.get<MusicSettingsResponse>("/music/settings");
      return res.settings;
    },
  });
}

/** 导入歌单 */
function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      api.post<PlaylistItem>("/admin/playlists", { url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "playlists"] });
    },
  });
}

/** 更新歌单启用状态 */
function useUpdatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/playlists/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "playlists"] });
    },
  });
}

/** 更新播放器版本 */
function useUpdatePlayerVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: string) =>
      api.patch("/admin/music/settings", { player_version: version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "music-settings"] });
      queryClient.invalidateQueries({ queryKey: ["music", "settings"] });
    },
  });
}

/** 删除歌单 */
function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/playlists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "playlists"] });
    },
  });
}

export default function PlaylistsAdmin() {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
  }>({ open: false, id: "" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data, isLoading, error } = usePlaylists();
  const { data: settings } = useMusicSettings();
  const createMutation = useCreatePlaylist();
  const updateMutation = useUpdatePlaylist();
  const updateVersionMutation = useUpdatePlayerVersion();
  const deleteMutation = useDeletePlaylist();

  async function handleImport() {
    if (!url.trim()) {
      toast.error("请输入歌单链接");
      return;
    }

    setImporting(true);
    try {
      const playlist = await createMutation.mutateAsync(url.trim());
      toast.success(`成功导入「${playlist.title}」`);
      setUrl("");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("导入失败，请检查链接格式");
      }
    } finally {
      setImporting(false);
    }
  }

  function handleToggleActive(id: string, currentActive: boolean) {
    setTogglingId(id);
    updateMutation.mutate(
      { id, is_active: !currentActive },
      {
        onSuccess: () => {
          toast.success(currentActive ? "已禁用歌单" : "已启用歌单");
          setTogglingId(null);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            toast.error(err.message);
          } else {
            toast.error("操作失败");
          }
          setTogglingId(null);
        },
      }
    );
  }

  function handleVersionChange(version: string) {
    // 如果已经是当前版本，不发送请求
    if (currentVersion === version) return;

    updateVersionMutation.mutate(version, {
      onSuccess: () => {
        toast.success(`已切换到 ${version === "v1" ? "APlayer" : "Plyr"} 播放器`);
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error("切换失败");
        }
      },
    });
  }

  function handleDelete() {
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("歌单已删除");
        setDeleteConfirm({ open: false, id: "" });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error("删除失败");
        }
        setDeleteConfirm({ open: false, id: "" });
      },
    });
  }

  const playlists = data?.playlists ?? [];
  const currentVersion = settings?.player_version || "v1";

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">音乐歌单</h1>
        <p className="text-muted-foreground">
          导入网易云音乐或 QQ 音乐歌单，前台播放器将播放所有启用的歌单
        </p>
      </div>

      {/* 播放器设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            播放器设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">播放器版本：</span>
            <div className="flex gap-2">
              <Button
                variant={currentVersion === "v1" ? "default" : "outline"}
                size="sm"
                onClick={() => handleVersionChange("v1")}
                disabled={updateVersionMutation.isPending}
              >
                APlayer (v1)
              </Button>
              <Button
                variant={currentVersion === "v2" ? "default" : "outline"}
                size="sm"
                onClick={() => handleVersionChange("v2")}
                disabled={updateVersionMutation.isPending}
              >
                Plyr (v2)
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentVersion === "v1"
                ? "简洁风格，适合单歌单播放"
                : "精美面板，支持多歌单合并播放"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 导入歌单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="size-5" />
            导入歌单
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="粘贴歌单链接，如 music.163.com/playlist?id=xxx"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : "导入"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 歌单列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="size-5" />
            歌单列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {error && <p className="text-destructive">加载失败</p>}

          {!isLoading && !error && playlists.length === 0 && (
            <EmptyState
              title="暂无歌单"
              description="导入歌单后，前台播放器可自动播放"
              icon={<Music className="size-12" />}
            />
          )}

          {!isLoading && !error && playlists.length > 0 && (
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
                      <img
                        src={playlist.cover}
                        alt={playlist.title}
                        className="size-10 rounded object-cover"
                      />
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
                        {playlist.platform === "netease" ? "网易云" : "QQ音乐"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {playlist.song_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={playlist.is_active}
                          onCheckedChange={() =>
                            handleToggleActive(playlist.id, playlist.is_active)
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDeleteConfirm({ open: true, id: playlist.id })
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: "" })}
        onConfirm={handleDelete}
        title="删除歌单"
        description="确定要删除这个歌单吗？前台播放器将无法播放。"
        confirmLabel="删除"
        destructive
      />
    </div>
  );
}