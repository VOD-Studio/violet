// 素材库选择器弹窗
// 支持从媒体库中选择图片作为封面或插入正文

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { api, getUploadUrl } from "@/lib/api";

interface MediaItem {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  path: string;
  width?: number;
  height?: number;
  created_at: string;
}

interface MediaPickerProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 选择媒体回调 */
  onSelect: (media: MediaItem) => void;
  /** MIME 类型筛选 */
  mimeTypeFilter?: string;
}

/**
 * 素材库选择器弹窗
 */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  mimeTypeFilter,
}: MediaPickerProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    async function loadMedia() {
      try {
        const res = await api.get<{ media: MediaItem[] }>(
          "/media",
          mimeTypeFilter ? { type: mimeTypeFilter } : {}
        );
        // 只显示图片类型
        const images = (res.media ?? []).filter((m) =>
          m.mime_type.startsWith("image/")
        );
        setMedia(images);
      } catch (err) {
        console.error("加载素材库失败:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMedia();
  }, [open, mimeTypeFilter]);

  function handleSelect() {
    const selected = media.find((m) => m.id === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>从素材库选择图片</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : media.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              素材库中没有图片，请先上传
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 overflow-auto max-h-100">
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
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSelect} disabled={!selectedId}>
            确定
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { MediaItem };
