// EditorDialogs.tsx
// 编辑器专用对话框组件：链接插入、图片插入

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/Segmented";
import { Loader2 } from "lucide-react";
import { getUploadUrl } from "@/lib/api";
import { EmptyState } from "../shared/EmptyState";
import {
  usePaginatedQuery,
  useInfiniteScroll,
} from "@/hooks/useInfiniteScroll";
import { fetchMediaPage, type MediaItem } from "@/features/admin/media";

/** 链接插入对话框属性 */
interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string, text?: string) => void;
  initialUrl?: string;
}

/** 图片插入对话框属性 */
interface ImageDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (src: string, alt?: string) => void;
}

/** 图片来源选项 */
const sourceOptions = [
  { label: "输入 URL", value: "url" },
  { label: "素材库", value: "media" },
] as const;

/**
 * 链接插入对话框
 */
export function LinkDialog({
  open,
  onClose,
  onInsert,
  initialUrl,
}: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [text, setText] = useState("");

  function handleInsert() {
    if (!url.trim()) return;
    onInsert(url.trim(), text.trim() || undefined);
    setUrl("");
    setText("");
    onClose();
  }

  function handleClose() {
    setUrl("");
    setText("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>插入链接</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">链接地址</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-text">显示文本（可选）</Label>
            <Input
              id="link-text"
              placeholder="链接显示的文字"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            插入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 图片插入对话框
 * 支持 URL 输入和从素材库选择，素材库支持无限滚动加载
 */
export function ImageDialog({ open, onClose, onInsert }: ImageDialogProps) {
  const [source, setSource] = useState<"url" | "media">("url");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 分页获取图片素材
  const fetchImages = useCallback(
    (page: number, limit: number) => fetchMediaPage(page, limit, "image"),
    []
  );

  const {
    items: media,
    isLoading,
    hasMore,
    loadMore,
  } = usePaginatedQuery<MediaItem>(
    ["editor", "media", "image"],
    fetchImages,
    20
  );

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
    rootRef: scrollContainerRef,
    enabled: mediaLoaded,
  });

  // 切换到素材库时标记已加载（触发首次请求）
  function handleSourceChange(value: "url" | "media") {
    setSource(value);
    if (value === "media") {
      setMediaLoaded(true);
    }
  }

  function handleInsertFromUrl() {
    if (!url.trim()) return;
    onInsert(url.trim(), alt.trim() || undefined);
    resetAndClose();
  }

  function handleInsertFromMedia() {
    const selected = media.find((m) => m.id === selectedId);
    if (selected) {
      onInsert(
        getUploadUrl(selected.path),
        alt.trim() || selected.original_name
      );
      resetAndClose();
    }
  }

  function resetAndClose() {
    setUrl("");
    setAlt("");
    setSelectedId(null);
    setSource("url");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>插入图片</DialogTitle>
        </DialogHeader>

        {/* 使用 Segmented 切换来源 */}
        <div className="pt-2">
          <Segmented
            options={sourceOptions}
            value={source}
            onChange={handleSourceChange}
          />
        </div>

        <div className="py-4 flex flex-col">
          {source === "url" ? (
            /* URL 模式：紧凑布局 */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">图片地址</Label>
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.jpg"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-alt">替代文本（可选）</Label>
                <Input
                  id="image-alt"
                  placeholder="图片描述"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                />
              </div>
            </div>
          ) : (
            /* Media 模式：无限滚动图片网格 */
            <div className="flex flex-col h-200">
              {!mediaLoaded || (isLoading && media.length === 0) ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : media.length === 0 ? (
                <EmptyState title="素材库中没有图片，请先上传" />
              ) : (
                <>
                  {/* 图片网格 - 可滚动 */}
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 flex flex-col overflow-auto"
                  >
                    <div className="grid grid-cols-4 gap-4 content-start">
                      {media.map((item) => (
                        <div
                          key={item.id}
                          className={`relative aspect-square cursor-pointer rounded-lg border-2 overflow-hidden transition-colors ${
                            selectedId === item.id
                              ? "border-primary"
                              : "border-transparent"
                          }`}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <img
                            src={getUploadUrl(item.path)}
                            alt={item.original_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    {/* 无限滚动哨兵 */}
                    {hasMore && (
                      <div
                        ref={sentinelRef}
                        className="flex justify-center py-4 shrink-0"
                      >
                        {isLoading && (
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* 替代文本输入 */}
                  <div className="space-y-2 mt-4 shrink-0">
                    <Label htmlFor="media-alt">替代文本（可选）</Label>
                    <Input
                      id="media-alt"
                      placeholder="图片描述"
                      value={alt}
                      onChange={(e) => setAlt(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            取消
          </Button>
          <Button
            onClick={
              source === "url" ? handleInsertFromUrl : handleInsertFromMedia
            }
            disabled={source === "url" ? !url.trim() : !selectedId}
          >
            插入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
