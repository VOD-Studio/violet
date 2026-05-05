/**
 * 图片显示组件
 * 负责图片的加载、缩放和动画效果
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ImagePreviewImageProps {
  /** 图片地址 */
  src: string;
  /** 图片描述 */
  alt: string;
  /** 缩放比例 */
  scale: number;
  /** 加载完成回调 */
  onLoad: () => void;
}

/**
 * 图片显示组件
 *
 * 功能：
 * - 图片加载状态管理
 * - 缩放动画效果
 * - 加载指示器
 * - 切换时的淡入淡出动画
 */
export function ImagePreviewImage({ src, alt, scale, onLoad }: ImagePreviewImageProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad();
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onLoad={handleLoad}
          className="max-w-full max-h-[90vh] object-contain select-none"
          style={{
            transform: `scale(${scale})`,
            transition: "transform 0.2s ease-out",
          }}
          draggable={false}
        />
      </AnimatePresence>

      {/* 加载指示器 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
