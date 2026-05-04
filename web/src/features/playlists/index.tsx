import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Link, Music } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  usePlaylists,
  useMusicSettings,
  useCreatePlaylist,
  useUpdatePlaylist,
  useUpdatePlayerVersion,
  useDeletePlaylist,
  useCreateCustomPlaylist,
} from "./api";
import { PlaylistsTable } from "./components/PlaylistsTable";
import {
  ImportPlaylistDialog,
  CreateCustomPlaylistDialog,
} from "./components/ImportPlaylistDialog";
import { EditPlaylistSheet } from "./components/EditPlaylistSheet";
import type { PlaylistItem } from "./types";

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

  const { data, isLoading, error } = usePlaylists();
  const { data: settings } = useMusicSettings();
  const createMutation = useCreatePlaylist();
  const updateMutation = useUpdatePlaylist();
  const updateVersionMutation = useUpdatePlayerVersion();
  const deleteMutation = useDeletePlaylist();
  const createCustomMutation = useCreateCustomPlaylist();

  const playlists = data?.playlists ?? [];
  const currentVersion = settings?.player_version || "v1";

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
        err instanceof ApiError ? err.message : "导入失败，请检查链接格式"
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
      }
    );
  }

  function handleVersionChange(version: string) {
    if (currentVersion === version) return;
    updateVersionMutation.mutate(version, {
      onSuccess: () =>
        toast.success(
          `已切换到 ${version === "v1" ? "APlayer" : "Plyr"} 播放器`
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
          <ImportPlaylistDialog
            url={url}
            importing={importing}
            onUrlChange={setUrl}
            onImport={handleImport}
            onCreateCustom={() => setCreateDialogOpen(true)}
          />
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
            <PlaylistsTable
              playlists={playlists}
              togglingId={togglingId}
              onToggleActive={handleToggleActive}
              onDelete={(id) => setDeleteConfirm({ open: true, id })}
              onManageSongs={setSheetPlaylist}
            />
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
      <CreateCustomPlaylistDialog
        open={createDialogOpen}
        title={newPlaylistTitle}
        creating={creating}
        onOpenChange={setCreateDialogOpen}
        onTitleChange={setNewPlaylistTitle}
        onCreate={handleCreateCustom}
      />

      {/* 歌曲管理侧边面板 */}
      <EditPlaylistSheet
        playlist={sheetPlaylist}
        onClose={() => setSheetPlaylist(null)}
      />
    </div>
  );
}
