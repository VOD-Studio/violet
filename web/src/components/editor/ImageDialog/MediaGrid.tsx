/**
 * 素材库图片网格组件（支持无限滚动）
 */

import { useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUploadUrl } from "@/lib/api";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  usePaginatedQuery,
  useInfiniteScroll,
} from "@/hooks/useInfiniteScroll";
import { fetchMediaPage, type MediaItem } from "@/features/admin/media";

interface MediaGridProps {
  alt: string;
  onAltChange: (alt: string) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  mediaLoaded: boolean;
}

export function MediaGrid({
  alt,
  onAltChange,
  selectedId,
  onSelectId,
  mediaLoaded,
}: MediaGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  if (!mediaLoaded || (isLoading && media.length === 0)) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (media.length === 0) {
    return <EmptyState title="素材库中没有图片，请先上传" />;
  }

  return (
    <>
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
              onClick={() => onSelectId(item.id)}
            >
              <img
                src={getUploadUrl(item.path)}
                alt={item.original_name}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
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

      <div className="space-y-2 mt-4 shrink-0">
        <Label htmlFor="media-alt">替代文本（可选）</Label>
        <Input
          id="media-alt"
          placeholder="图片描述"
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
        />
      </div>
    </>
  );
}
