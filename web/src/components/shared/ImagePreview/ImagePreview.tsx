/**
 * 图片预览组件
 * 支持全屏预览、缩放动画、多图切换、键盘操作
 * 类似哔哩哔哩/微信的图片预览效果
 */

import { motion, AnimatePresence } from "motion/react";
import { useImagePreviewControls } from "./useImagePreviewControls";
import { ImagePreviewControls } from "./ImagePreviewControls";
import { ImagePreviewImage } from "./ImagePreviewImage";
import { ImagePreviewThumbnails } from "./ImagePreviewThumbnails";
import type { ImagePreviewProps } from "./types";

/**
 * 计算动画起点位置
 * 用于实现从触发元素到全屏的平滑过渡动画
 */
function getInitialPosition(triggerElement?: HTMLElement | null) {
  if (!triggerElement) return { x: 0, y: 0, scale: 0.8 };

  const rect = triggerElement.getBoundingClientRect();
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  return {
    x: rect.left + rect.width / 2 - centerX,
    y: rect.top + rect.height / 2 - centerY,
    scale: Math.min(rect.width / window.innerWidth, rect.height / window.innerHeight),
  };
}

/**
 * 图片预览主组件
 *
 * 功能特性：
 * - 全屏预览，支持缩放（0.5x - 3x）
 * - 多图切换，支持键盘操作（←/→）
 * - 从触发元素位置平滑展开的动画效果
 * - 缩略图导航（2-10 张图片时显示）
 * - 键盘快捷键：ESC 关闭，+/- 缩放
 */
export function ImagePreview({
  open,
  onClose,
  images,
  currentIndex = 0,
  onIndexChange,
  triggerElement,
}: ImagePreviewProps) {
  const {
    index,
    scale,
    setIndex,
    handlePrevious,
    handleNext,
    handleZoomIn,
    handleZoomOut,
  } = useImagePreviewControls({
    open,
    images,
    currentIndex,
    onIndexChange,
    onClose,
  });

  const initialPosition = getInitialPosition(triggerElement);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={onClose}
        >
          {/* 控制按钮 */}
          <ImagePreviewControls
            scale={scale}
            currentIndex={index}
            totalImages={images.length}
            onClose={onClose}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />

          {/* 图片容器 */}
          <motion.div
            initial={{
              x: initialPosition.x,
              y: initialPosition.y,
              scale: initialPosition.scale,
            }}
            animate={{ x: 0, y: 0, scale: 1 }}
            exit={{
              x: initialPosition.x,
              y: initialPosition.y,
              scale: initialPosition.scale,
            }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <ImagePreviewImage
              src={images[index]}
              alt={`预览图片 ${index + 1}`}
              scale={scale}
              onLoad={() => {}}
            />
          </motion.div>

          {/* 缩略图导航 */}
          <ImagePreviewThumbnails
            images={images}
            currentIndex={index}
            onSelect={(i) => {
              setIndex(i);
              onIndexChange?.(i);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
