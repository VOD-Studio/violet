/**
 * 音乐歌单管理页面
 * 支持导入网易云/QQ音乐歌单、设置启用、删除
 * 支持切换播放器版本 (v1: APlayer, v2: Plyr)
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getUploadUrl } from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Plus,
  Upload,
  ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/** 歌曲数据 */
interface Song {
  title: string;
  artist: string;
  cover: string;
  url: string;
}

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
  songs?: Song[];
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

/** 创建自定义歌单 */
function useCreateCustomPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<PlaylistItem>("/admin/playlists/custom", { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "playlists"] });
    },
  });
}

/** 上传歌曲到歌单 */
function useUploadSong(playlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await api.post(`/admin/playlists/${playlistId}/songs`, formData);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "playlists"] });
    },
  });
}

/** 删除歌单中的歌曲 */
function useDeleteSong(playlistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songIndex: number) =>
      api.del(`/admin/playlists/${playlistId}/songs/${songIndex}`),
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

  // 自定义歌单相关状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [songDialogPlaylist, setSongDialogPlaylist] =
    useState<PlaylistItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data, isLoading, error } = usePlaylists();
  const { data: settings } = useMusicSettings();
  const createMutation = useCreatePlaylist();
  const updateMutation = useUpdatePlaylist();
  const updateVersionMutation = useUpdatePlayerVersion();
  const deleteMutation = useDeletePlaylist();
  const createCustomMutation = useCreateCustomPlaylist();
  const uploadSongMutation = songDialogPlaylist
    ? useUploadSong(songDialogPlaylist.id)
    : null;
  const deleteSongMutation = songDialogPlaylist
    ? useDeleteSong(songDialogPlaylist.id)
    : null;

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

  async function handleCreateCustom() {
    if (!newPlaylistTitle.trim()) {
      toast.error("请输入歌单名称");
      return;
    }
    setCreating(true);
    try {
      const playlist = await createCustomMutation.mutateAsync(
        newPlaylistTitle.trim()
      );
      toast.success(`已创建歌单「${playlist.title}」`);
      setNewPlaylistTitle("");
      setCreateDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("创建失败");
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUploadFiles(files: FileList | File[]) {
    if (!uploadSongMutation) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadSongMutation.mutateAsync(file);
      }
      toast.success(`成功上传 ${files.length} 首歌曲`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("上传失败");
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteSong(songIndex: number) {
    if (!deleteSongMutation) return;
    deleteSongMutation.mutate(songIndex, {
      onSuccess: () => toast.success("歌曲已删除"),
      onError: (err) => {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error("删除失败");
        }
      },
    });
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("audio/")
      );
      if (files.length > 0) {
        handleUploadFiles(files);
      } else {
        toast.error("请上传音频文件");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadSongMutation]
  );

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
            <div className="mx-1 w-px bg-border" />
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-4" />
              创建歌单
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
                        {playlist.platform === "netease"
                          ? "网易云"
                          : playlist.platform === "qq"
                            ? "QQ音乐"
                            : "自定义"}
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
                      <div className="flex items-center gap-1">
                        {playlist.platform === "custom" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setSongDialogPlaylist(playlist)}
                            title="管理歌曲"
                          >
                            <ListMusic className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setDeleteConfirm({ open: true, id: playlist.id })
                          }
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
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

      {/* 创建自定义歌单对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建自定义歌单</DialogTitle>
            <DialogDescription>
              创建空白歌单后，可以手动上传音频文件
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="输入歌单名称"
              value={newPlaylistTitle}
              onChange={(e) => setNewPlaylistTitle(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCustom();
              }}
            />
            <Button onClick={handleCreateCustom} disabled={creating}>
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "创建"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 歌曲管理对话框 */}
      <Dialog
        open={!!songDialogPlaylist}
        onOpenChange={(open) => {
          if (!open) setSongDialogPlaylist(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListMusic className="size-5" />
              {songDialogPlaylist?.title} - 歌曲管理
            </DialogTitle>
            <DialogDescription>
              上传音频文件或管理已有歌曲
            </DialogDescription>
          </DialogHeader>

          {/* 上传区域 */}
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              拖拽音频文件到此处，或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground">
              支持 MP3、WAV、OGG、FLAC、AAC 格式
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              选择文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadFiles(e.target.files);
                  e.target.value = "";
                }
              }}
            />
          </div>

          {/* 歌曲列表 */}
          {songDialogPlaylist &&
            (songDialogPlaylist.songs?.length ?? 0) > 0 && (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-12">封面</TableHead>
                      <TableHead>标题</TableHead>
                      <TableHead>艺术家</TableHead>
                      <TableHead className="w-16">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {songDialogPlaylist.songs!.map((song, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          {song.cover && (
                            <img
                              src={getUploadUrl(song.cover)}
                              alt={song.title}
                              className="size-8 rounded object-cover"
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {song.title || "未知标题"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {song.artist || "未知艺术家"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteSong(index)}
                            disabled={deleteSongMutation?.isPending}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

          {songDialogPlaylist &&
            (songDialogPlaylist.songs?.length ?? 0) === 0 && (
              <EmptyState
                title="暂无歌曲"
                description="上传音频文件添加歌曲"
                icon={<Music className="size-10" />}
              />
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}