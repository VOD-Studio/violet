/**
 * 图片预览状态管理 Hook
 * 简化图片预览组件的使用，管理打开/关闭状态和图片列表
 */

import { useCallback, useState } from "react";

/**
 * 图片预览 Hook
 *
 * 功能：
 * - 管理预览打开/关闭状态
 * - 管理图片列表和当前索引
 * - 记录触发元素用于动画
 * - 提供 openPreview 和 closePreview 方法
 *
 * @example
 * const preview = useImagePreview();
 * <img onClick={(e) => preview.openPreview([url1, url2], 0, e.currentTarget)} />
 * <ImagePreview {...preview} />
 */
export function useImagePreview() {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  const openPreview = useCallback(
    (imageList: string[], index = 0, element?: HTMLElement) => {
      setImages(imageList);
      setCurrentIndex(index);
      setTriggerElement(element || null);
      setOpen(true);
    },
    []
  );

  const closePreview = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    images,
    currentIndex,
    triggerElement,
    openPreview,
    closePreview,
    setCurrentIndex,
  };
}
