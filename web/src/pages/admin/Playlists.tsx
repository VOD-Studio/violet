/**
 * 音乐歌单管理页面
 * 支持导入网易云/QQ音乐歌单、设置启用、删除
 * 自定义歌单支持上传音频、编辑元数据、一键获取歌词封面
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
  Search,
  Pencil,
  Wand2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

/** 歌曲数据 */
interface Song {
  title: string;
  artist: string;
  cover: string;
  url: string;
  lrc?: string;
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

/** 搜索结果 */
interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  platform: string;
  url: string;
  lrc: string;
}

// --- Query Hooks ---

function usePlaylists() {
  return useQuery({
    queryKey: ["admin", "playlists"],
    queryFn: () => api.get<PlaylistListResponse>("/admin/playlists"),
  });
}

function useMusicSettings() {
  return useQuery({
    queryKey: ["admin", "music-settings"],
    queryFn: async () => {
      const res = await api.get<MusicSettingsResponse>("/music/settings");
      return res.settings;
    },
  });
}

function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      api.post<PlaylistItem>("/admin/playlists", { url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/playlists/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useUpdatePlayerVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: string) =>
      api.patch("/admin/music/settings", { player_version: version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "music-settings"] });
      qc.invalidateQueries({ queryKey: ["music", "settings"] });
    },
  });
}

function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/playlists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useCreateCustomPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<PlaylistItem>("/admin/playlists/custom", { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useUploadSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      return api.post<PlaylistItem>(
        `/admin/playlists/${playlistId}/songs`,
        formData,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useDeleteSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (songIndex: number) =>
      api.del<PlaylistItem>(`/admin/playlists/${playlistId}/songs/${songIndex}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

function useUpdateSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      index,
      data,
    }: {
      index: number;
      data: { title: string; artist: string; cover: string; lrc: string };
    }) =>
      api.patch<PlaylistItem>(
        `/admin/playlists/${playlistId}/songs/${index}`,
        data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

// --- Main Component ---

export default function PlaylistsAdmin() {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    id: string;
  }>({ open: false, id: "" });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 自定义歌单相关
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // 歌曲管理 Sheet
  const [sheetPlaylist, setSheetPlaylist] = useState<PlaylistItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // 歌曲编辑
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    artist: "",
    cover: "",
    lrc: "",
  });

  // 搜索
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);

  const { data, isLoading, error } = usePlaylists();
  const { data: settings } = useMusicSettings();
  const createMutation = useCreatePlaylist();
  const updateMutation = useUpdatePlaylist();
  const updateVersionMutation = useUpdatePlayerVersion();
  const deleteMutation = useDeletePlaylist();
  const createCustomMutation = useCreateCustomPlaylist();
  const uploadSongMutation = useUploadSong(sheetPlaylist?.id ?? "");
  const deleteSongMutation = useDeleteSong(sheetPlaylist?.id ?? "");
  const updateSongMutation = useUpdateSong(sheetPlaylist?.id ?? "");

  const playlists = data?.playlists ?? [];
  const currentVersion = settings?.player_version || "v1";

  const ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/aac",
    "audio/mp4",
    "audio/x-m4a",
  ];

  // --- Handlers ---

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
      toast.error(
        err instanceof ApiError ? err.message : "导入失败，请检查链接格式",
      );
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
          toast.error(err instanceof ApiError ? err.message : "操作失败");
          setTogglingId(null);
        },
      },
    );
  }

  function handleVersionChange(version: string) {
    if (currentVersion === version) return;
    updateVersionMutation.mutate(version, {
      onSuccess: () =>
        toast.success(
          `已切换到 ${version === "v1" ? "APlayer" : "Plyr"} 播放器`,
        ),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "切换失败"),
    });
  }

  function handleDelete() {
    deleteMutation.mutate(deleteConfirm.id, {
      onSuccess: () => {
        toast.success("歌单已删除");
        setDeleteConfirm({ open: false, id: "" });
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "删除失败");
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
      await createCustomMutation.mutateAsync(newPlaylistTitle.trim());
      toast.success(`已创建歌单「${newPlaylistTitle.trim()}」`);
      setNewPlaylistTitle("");
      setCreateDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleUploadFiles(files: FileList | File[]) {
    if (!sheetPlaylist) return;
    const audioFiles = Array.from(files).filter(
      (f) => ALLOWED_AUDIO_TYPES.includes(f.type) || f.type.startsWith("audio/"),
    );
    if (audioFiles.length === 0) {
      toast.error("请上传音频文件（MP3、WAV、OGG、FLAC、AAC）");
      return;
    }
    setUploading(true);
    try {
      let latest: PlaylistItem | undefined;
      for (const file of audioFiles) {
        latest = await uploadSongMutation.mutateAsync(file);
      }
      if (latest) setSheetPlaylist(latest);
      toast.success(`成功上传 ${audioFiles.length} 首歌曲`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteSong(songIndex: number) {
    if (!sheetPlaylist) return;
    deleteSongMutation.mutate(songIndex, {
      onSuccess: (data) => {
        setSheetPlaylist(data);
        if (editingIndex === songIndex) setEditingIndex(null);
        toast.success("歌曲已删除");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "删除失败"),
    });
  }

  function handleStartEdit(index: number) {
    const song = sheetPlaylist?.songs?.[index];
    if (!song) return;
    setEditingIndex(editingIndex === index ? null : index);
    setEditForm({
      title: song.title || "",
      artist: song.artist || "",
      cover: song.cover || "",
      lrc: song.lrc || "",
    });
    setSearchTarget(index);
  }

  async function handleSaveEdit(index: number) {
    updateSongMutation.mutate(
      { index, data: editForm },
      {
        onSuccess: (data) => {
          setSheetPlaylist(data);
          setEditingIndex(null);
          toast.success("歌曲信息已更新");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "更新失败"),
      },
    );
  }

  async function handleSearch() {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    try {
      const results = await api.get<SearchResult[]>(
        `/music/search?keyword=${encodeURIComponent(searchKeyword.trim())}&limit=5`,
      );
      setSearchResults(results || []);
    } catch {
      toast.error("搜索失败");
    } finally {
      setSearching(false);
    }
  }

  async function handleAutoFetch() {
    const keyword = editForm.title.trim();
    if (!keyword) return;
    setSearching(true);
    try {
      const results = await api.get<SearchResult[]>(
        `/music/search?keyword=${encodeURIComponent(keyword)}&limit=5`,
      );
      if (results && results.length > 0) {
        handleApplySearchResult(results[0]);
      } else {
        toast.error("未找到匹配的歌曲");
      }
    } catch {
      toast.error("自动获取失败");
    } finally {
      setSearching(false);
    }
  }

  async function handleApplySearchResult(result: SearchResult) {
    setEditForm((prev) => ({
      ...prev,
      title: result.title || prev.title,
      artist: result.artist || prev.artist,
      cover: result.cover || prev.cover,
      lrc: result.lrc || prev.lrc,
    }));
    setSearchResults([]);
    setSearchKeyword("");
    toast.success("已填充歌曲信息");

    // 如果搜索结果没有歌词，用歌曲 ID 异步获取
    if (!result.lrc && result.id) {
      try {
        const res = await api.get<{ lrc: string }>(
          `/music/lyrics?platform=${result.platform || "netease"}&id=${result.id}`,
        );
        if (res.lrc) {
          setEditForm((prev) => ({ ...prev, lrc: res.lrc }));
        }
      } catch {
        // 歌词获取失败不影响主流程
      }
    }
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
        f.type.startsWith("audio/"),
      );
      if (files.length > 0) handleUploadFiles(files);
      else toast.error("请上传音频文件");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadSongMutation],
  );

  // --- Render ---

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
                            onClick={() => {
                              setSheetPlaylist(playlist);
                              setEditingIndex(null);
                            }}
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

      {/* 创建自定义歌单 */}
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

      {/* 歌曲管理侧边面板 */}
      <Sheet
        open={!!sheetPlaylist}
        onOpenChange={(open) => {
          if (!open) {
            setSheetPlaylist(null);
            setEditingIndex(null);
            setSearchResults([]);
          }
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListMusic className="size-5" />
              {sheetPlaylist?.title} - 歌曲管理
            </SheetTitle>
            <SheetDescription>
              上传音频文件、编辑歌曲信息、一键获取歌词和封面
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 上传区域 */}
            <div
              className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-1 text-sm text-muted-foreground">
                拖拽音频文件到此处，或点击选择
              </p>
              <p className="text-xs text-muted-foreground">
                支持 MP3、WAV、OGG、FLAC、AAC
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
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
                    handleUploadFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* 歌曲列表 */}
            {sheetPlaylist && (sheetPlaylist.songs?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {sheetPlaylist.songs!.map((song, index) => (
                  <div
                    key={index}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    {/* 歌曲行 */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      {song.cover ? (
                        <img
                          src={getUploadUrl(song.cover)}
                          alt={song.title}
                          className="size-9 rounded object-cover"
                        />
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded bg-muted">
                          <Music className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {song.title || "未知标题"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {song.artist || "未知艺术家"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleStartEdit(index)}
                          title="编辑"
                        >
                          {editingIndex === index ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <Pencil className="size-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteSong(index)}
                          disabled={deleteSongMutation.isPending}
                          title="删除"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* 编辑面板 */}
                    {editingIndex === index && (
                      <div className="space-y-3 border-t pt-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              标题
                            </label>
                            <Input
                              value={editForm.title}
                              onChange={(e) =>
                                setEditForm((p) => ({
                                  ...p,
                                  title: e.target.value,
                                }))
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              艺术家
                            </label>
                            <Input
                              value={editForm.artist}
                              onChange={(e) =>
                                setEditForm((p) => ({
                                  ...p,
                                  artist: e.target.value,
                                }))
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            封面 URL
                          </label>
                          <Input
                            value={editForm.cover}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                cover: e.target.value,
                              }))
                            }
                            className="h-8 text-sm"
                            placeholder="https://..."
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">
                            歌词 (LRC)
                          </label>
                          <Textarea
                            value={editForm.lrc}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                lrc: e.target.value,
                              }))
                            }
                            className="text-xs font-mono"
                            rows={4}
                            placeholder="[00:00.00]歌词内容..."
                          />
                        </div>

                        {/* 一键获取信息 */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={searchKeyword}
                              onChange={(e) => setSearchKeyword(e.target.value)}
                              placeholder="搜索歌曲名获取封面和歌词..."
                              className="h-8 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearch();
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSearch}
                              disabled={searching}
                              className="h-8 shrink-0"
                            >
                              {searching ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Search className="size-3" />
                              )}
                            </Button>
                            {searchTarget === index && editForm.title && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 shrink-0"
                                onClick={handleAutoFetch}
                                disabled={searching}
                                title="使用当前标题自动搜索"
                              >
                                {searching ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Wand2 className="size-3" />
                                )}
                              </Button>
                            )}
                          </div>
                          {searchResults.length > 0 && (
                            <div className="rounded border max-h-48 overflow-y-auto">
                              {searchResults.map((result) => (
                                <button
                                  key={result.id}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent transition-colors"
                                  onClick={() =>
                                    handleApplySearchResult(result)
                                  }
                                >
                                  {result.cover && (
                                    <img
                                      src={result.cover}
                                      alt=""
                                      className="size-8 rounded object-cover"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                      {result.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {result.artist}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                          >
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(index)}
                            disabled={updateSongMutation.isPending}
                          >
                            {updateSongMutation.isPending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : null}
                            保存
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sheetPlaylist && (sheetPlaylist.songs?.length ?? 0) === 0 && (
              <EmptyState
                title="暂无歌曲"
                description="上传音频文件添加歌曲"
                icon={<Music className="size-10" />}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
