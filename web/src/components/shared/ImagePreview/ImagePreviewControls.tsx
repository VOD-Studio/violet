/**
 * 图片预览控制按钮组件
 * 包含顶部工具栏（缩放、旋转、翻转、关闭）和左右切换按钮
 */

import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
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
  /** 左旋转回调 */
  onRotateLeft?: () => void;
  /** 右旋转回调 */
  onRotateRight?: () => void;
  /** 水平翻转回调 */
  onFlipX?: () => void;
  /** 垂直翻转回调 */
  onFlipY?: () => void;
}

/**
 * 图片预览控制按钮组件
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
  onRotateLeft,
  onRotateRight,
  onFlipX,
  onFlipY,
}: ImagePreviewControlsProps) {
  // 阻止事件冒泡
  const handleClick = (callback: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    callback();
  };

  return (
    <>
      {/* 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-linear-to-b from-black/50 to-transparent">
        {/* 左侧：缩放、旋转、翻转 */}
        <div className="flex items-center gap-2">
          {/* 缩放 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick(onZoomOut)}
            disabled={scale <= 0.5}
            className="text-white hover:bg-white/20 active:scale-100"
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white text-sm min-w-12.5 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick(onZoomIn)}
            disabled={scale >= 3}
            className="text-white hover:bg-white/20 active:scale-100"
          >
            <ZoomIn className="h-5 w-5" />
          </Button>

          {/* 分隔线 */}
          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* 旋转 */}
          {onRotateLeft && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick(onRotateLeft)}
              className="text-white hover:bg-white/20 active:scale-100"
              title="左旋转"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          )}
          {onRotateRight && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick(onRotateRight)}
              className="text-white hover:bg-white/20 active:scale-100"
              title="右旋转"
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          )}

          {/* 翻转 */}
          {onFlipX && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick(onFlipX)}
              className="text-white hover:bg-white/20 active:scale-100"
              title="水平翻转"
            >
              <FlipHorizontal className="h-5 w-5" />
            </Button>
          )}
          {onFlipY && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick(onFlipY)}
              className="text-white hover:bg-white/20 active:scale-100"
              title="垂直翻转"
            >
              <FlipVertical className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* 右侧：图片计数、关闭 */}
        <div className="flex items-center gap-2">
          {totalImages > 1 && (
            <span className="text-white text-sm">
              {currentIndex + 1} / {totalImages}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick(onClose)}
            className="text-white hover:bg-white/20 active:scale-100"
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
            onClick={handleClick(onPrevious)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 active:translate-y-[-50%]!"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick(onNext)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 active:translate-y-[-50%]!"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}
    </>
  );
}
