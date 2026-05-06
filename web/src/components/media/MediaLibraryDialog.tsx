/**
 * 媒体库弹窗组件
 * 支持类型筛选、无限滚动、单选/多选模式
 */

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/Segmented";
import { EmptyState } from "@/components/shared/EmptyState";
import { Loader2, Image as ImageIcon, CheckSquare } from "lucide-react";
import { getUploadUrl } from "@/lib/api";
import {
  usePaginatedQuery,
  useInfiniteScroll,
} from "@/hooks/useInfiniteScroll";
import { fetchMediaPage, type MediaItem } from "@/features/admin/media";

/** 分类选项 */
const categoryOptions = [
  { label: "全部", value: "all" },
  { label: "图片", value: "image" },
  { label: "视频", value: "video" },
  { label: "音频", value: "audio" },
  { label: "文档", value: "application" },
];

export interface MediaLibraryDialogProps {
  /** 是否打开弹窗 */
  open: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
  /** 选择媒体回调（单选模式） */
  onSelect?: (media: MediaItem) => void;
  /** 多选回调（多选模式） */
  onSelectMultiple?: (media: MediaItem[]) => void;
  /** 是否多选模式 */
  multiple?: boolean;
  /** 默认类型筛选 */
  defaultCategory?: string;
  /** 可选的类型列表（限制用户只能选择某些类型） */
  allowedCategories?: string[];
  /** 弹窗标题 */
  title?: string;
  /** 确认按钮文本 */
  confirmLabel?: string;
}

export function MediaLibraryDialog({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  multiple = false,
  defaultCategory = "all",
  allowedCategories,
  title = "选择媒体",
  confirmLabel = "确定",
}: MediaLibraryDialogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 过滤可用的分类选项
  const availableCategories = allowedCategories
    ? categoryOptions.filter((opt) =>
        opt.value === "all" ? true : allowedCategories.includes(opt.value)
      )
    : categoryOptions;

  const currentMimeType = category === "all" ? undefined : category;

  const fetchFn = useCallback(
    (page: number, limit: number) =>
      fetchMediaPage(page, limit, currentMimeType),
    [currentMimeType]
  );

  const {
    items: mediaItems,
    isLoading,
    hasMore,
    loadMore,
  } = usePaginatedQuery<MediaItem>(["media-library", category], fetchFn, 20);

  const sentinelRef = useInfiniteScroll({
    hasMore,
    isLoading,
    onLoadMore: loadMore,
    rootRef: scrollContainerRef,
    enabled: open,
  });

  // 弹窗关闭时重置状态
  function handleClose() {
    setSelectedIds(new Set());
    onClose();
  }

  // 选择单个媒体
  function handleItemClick(item: MediaItem) {
    if (multiple) {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
      } else {
        newSelected.add(item.id);
      }
      setSelectedIds(newSelected);
    } else {
      // 单选模式直接返回
      onSelect?.(item);
      handleClose();
    }
  }

  // 全选当前已加载的数据
  function handleSelectAll() {
    const allIds = new Set(mediaItems.map((item) => item.id));
    setSelectedIds(allIds);
  }

  // 清空选择
  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  // 确认多选
  function handleConfirmMultiple() {
    const selectedItems = mediaItems.filter((item) => selectedIds.has(item.id));
    onSelectMultiple?.(selectedItems);
    handleClose();
  }

  // 获取选中数量
  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* 类型筛选 */}
        {availableCategories.length > 1 && (
          <div className="py-2">
            <Segmented
              options={availableCategories}
              value={category}
              onChange={(value) => setCategory(value)}
            />
          </div>
        )}

        {/* 媒体网格 */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto min-h-0 max-h-60vh"
        >
          {isLoading && mediaItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mediaItems.length === 0 ? (
            <EmptyState
              title="暂无媒体文件"
              description="请先上传媒体文件"
              icon={<ImageIcon className="size-12" />}
            />
          ) : (
            <div className="grid grid-cols-4 gap-4 content-start p-1">
              {mediaItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`relative aspect-square cursor-pointer rounded-lg border-2 overflow-hidden transition-colors ${
                      isSelected ? "border-primary" : "border-transparent"
                    }`}
                    onClick={() => handleItemClick(item)}
                  >
                    {/* 媒体预览 */}
                    {item.mime_type.startsWith("image/") ? (
                      <img
                        src={getUploadUrl(item.path)}
                        alt={item.original_name}
                        className="h-full w-full object-cover"
                      />
                    ) : item.mime_type.startsWith("video/") ? (
                      item.thumbnail ? (
                        <img
                          src={getUploadUrl(item.thumbnail)}
                          alt={item.original_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-muted">
                          <Loader2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-muted text-xs text-muted-foreground truncate p-2">
                        {item.original_name}
                      </div>
                    )}

                    {/* 多选模式下显示勾选标记 */}
                    {multiple && isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckSquare className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 无限滚动哨兵 */}
              {hasMore && (
                <div
                  ref={sentinelRef}
                  className="col-span-4 flex justify-center py-4"
                >
                  {isLoading && (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        {multiple && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 mr-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={mediaItems.length === 0}
              >
                全选
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
              >
                清空 ({selectedCount})
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button
                onClick={handleConfirmMultiple}
                disabled={selectedCount === 0}
              >
                {confirmLabel} ({selectedCount})
              </Button>
            </div>
          </DialogFooter>
        )}

        {!multiple && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              取消
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MediaLibraryDialog;
