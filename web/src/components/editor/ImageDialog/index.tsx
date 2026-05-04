/**
 * 图片插入对话框
 * 支持 URL 输入和从素材库选择
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/Segmented";
import { getUploadUrl } from "@/lib/api";
import { type MediaItem } from "@/features/admin/media";
import { UrlInput } from "./UrlInput";
import { MediaGrid } from "./MediaGrid";

interface ImageDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (src: string, alt?: string) => void;
}

const sourceOptions = [
  { label: "输入 URL", value: "url" },
  { label: "素材库", value: "media" },
] as const;

export function ImageDialog({ open, onClose, onInsert }: ImageDialogProps) {
  const [source, setSource] = useState<"url" | "media">("url");
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);

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
    if (!selectedId) return;

    const mediaQuery = (window as any).queryClient?.getQueryData(["editor", "media", "image"]) as {
      pages: Array<{ items: MediaItem[] }>;
    } | undefined;

    const allMedia = mediaQuery?.pages.flatMap((page: any) => page.items) ?? [];
    const selected = allMedia.find((m: MediaItem) => m.id === selectedId);

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

        <div className="pt-2">
          <Segmented
            options={sourceOptions}
            value={source}
            onChange={handleSourceChange}
          />
        </div>

        <div className="py-4 flex flex-col">
          {source === "url" ? (
            <UrlInput
              url={url}
              alt={alt}
              onUrlChange={setUrl}
              onAltChange={setAlt}
            />
          ) : (
            <div className="flex flex-col h-200">
              <MediaGrid
                alt={alt}
                onAltChange={setAlt}
                selectedId={selectedId}
                onSelectId={setSelectedId}
                mediaLoaded={mediaLoaded}
              />
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
