/**
 * 图片预览控制按钮组件
 * 包含顶部工具栏（缩放、关闭）和左右切换按钮
 */

import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewControlsProps {
  /** 当前缩放比例 */
  scale: number;
  /** 当前图片索引 */
  currentIndex: number;
  /** 图片总数 */
  totalImages: number;
  /** 关闭回调 */
  onClose: () => void;
  /** 放大回调 */
  onZoomIn: () => void;
  /** 缩小回调 */
  onZoomOut: () => void;
  /** 上一张回调 */
  onPrevious: () => void;
  /** 下一张回调 */
  onNext: () => void;
}

/**
 * 图片预览控制按钮组件
 *
 * 包含：
 * - 顶部工具栏：缩放控制、图片计数、关闭按钮
 * - 左右切换按钮（多图时显示）
 */
export function ImagePreviewControls({
  scale,
  currentIndex,
  totalImages,
  onClose,
  onZoomIn,
  onZoomOut,
  onPrevious,
  onNext,
}: ImagePreviewControlsProps) {
  return (
    <>
      {/* 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            disabled={scale <= 0.5}
            className="text-white hover:bg-white/20"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white text-sm min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            disabled={scale >= 3}
            className="text-white hover:bg-white/20"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {totalImages > 1 && (
            <span className="text-white text-sm">
              {currentIndex + 1} / {totalImages}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 左右切换按钮 */}
      {totalImages > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}
    </>
  );
}
