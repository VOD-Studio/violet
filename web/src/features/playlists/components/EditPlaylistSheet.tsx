import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Music,
  Trash2,
  Loader2,
  Upload,
  Pencil,
  Search,
  Wand2,
  ChevronUp,
  ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { api, getUploadUrl } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { PlaylistItem, SearchResult } from "../types";
import { useUploadSong, useDeleteSong, useUpdateSong } from "../api";

interface EditPlaylistSheetProps {
  playlist: PlaylistItem | null;
  onClose: () => void;
}

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
];

export function EditPlaylistSheet({
  playlist,
  onClose,
}: EditPlaylistSheetProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    artist: "",
    cover: "",
    lrc: "",
  });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);
  const [sheetPlaylist, setSheetPlaylist] = useState<PlaylistItem | null>(
    playlist
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadSongMutation = useUploadSong(sheetPlaylist?.id ?? "");
  const deleteSongMutation = useDeleteSong(sheetPlaylist?.id ?? "");
  const updateSongMutation = useUpdateSong(sheetPlaylist?.id ?? "");

  // Update local state when playlist prop changes
  if (playlist !== sheetPlaylist && playlist) {
    setSheetPlaylist(playlist);
  }

  async function handleUploadFiles(files: FileList | File[]) {
    if (!sheetPlaylist) return;
    const audioFiles = Array.from(files).filter(
      (f) => ALLOWED_AUDIO_TYPES.includes(f.type) || f.type.startsWith("audio/")
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
      }
    );
  }

  async function handleSearch() {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    try {
      const results = await api.get<SearchResult[]>(
        `/music/search?keyword=${encodeURIComponent(searchKeyword.trim())}&limit=5`
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
        `/music/search?keyword=${encodeURIComponent(keyword)}&limit=5`
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

    if (!result.lrc && result.id) {
      try {
        const res = await api.get<{ lrc: string }>(
          `/music/lyrics?platform=${result.platform || "netease"}&id=${result.id}`
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
        f.type.startsWith("audio/")
      );
      if (files.length > 0) handleUploadFiles(files);
      else toast.error("请上传音频文件");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploadSongMutation]
  );

  return (
    <Sheet
      open={!!playlist}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
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
                <div key={index} className="rounded-lg border p-3 space-y-2">
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
                                onClick={() => handleApplySearchResult(result)}
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
  );
}
