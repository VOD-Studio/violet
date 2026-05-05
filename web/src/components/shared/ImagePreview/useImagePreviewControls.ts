/**
 * 图片预览控制逻辑 Hook
 * 管理图片索引、缩放、键盘操作等交互逻辑
 */

import { useEffect, useCallback, useState } from "react";

interface UseImagePreviewControlsProps {
  /** 是否打开预览 */
  open: boolean;
  /** 图片列表 */
  images: string[];
  /** 当前图片索引 */
  currentIndex: number;
  /** 索引变化回调 */
  onIndexChange?: (index: number) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 图片预览控制 Hook
 *
 * 功能：
 * - 管理当前图片索引和缩放比例
 * - 处理上一张/下一张切换
 * - 处理缩放操作（放大/缩小）
 * - 监听键盘事件（ESC、方向键、+/-）
 * - 阻止背景滚动
 */
export function useImagePreviewControls({
  open,
  images,
  currentIndex,
  onIndexChange,
  onClose,
}: UseImagePreviewControlsProps) {
  const [index, setIndex] = useState(currentIndex);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (open) {
      setScale(1);
    }
  }, [open, index]);

  const handlePrevious = useCallback(() => {
    if (images.length <= 1) return;
    const newIndex = index > 0 ? index - 1 : images.length - 1;
    setIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [index, images.length, onIndexChange]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    const newIndex = index < images.length - 1 ? index + 1 : 0;
    setIndex(newIndex);
    onIndexChange?.(newIndex);
  }, [index, images.length, onIndexChange]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.5, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.5, 0.5));
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, handlePrevious, handleNext, handleZoomIn, handleZoomOut]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return {
    index,
    scale,
    setIndex,
    handlePrevious,
    handleNext,
    handleZoomIn,
    handleZoomOut,
  };
}
