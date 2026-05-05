/**
 * 图片显示组件
 * 负责图片的加载、缩放、拖拽和动画效果
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ImagePreviewImageProps {
  /** 图片地址 */
  src: string;
  /** 图片描述 */
  alt: string;
  /** 缩放比例 */
  scale: number;
  /** 旋转角度 */
  rotate?: number;
  /** 水平翻转 */
  flipX?: boolean;
  /** 垂直翻转 */
  flipY?: boolean;
  /** 加载完成回调 */
  onLoad: () => void;
}

/**
 * 图片显示组件
 *
 * 功能：
 * - 图片加载状态管理
 * - 缩放动画效果
 * - 拖拽移动
 * - 加载指示器
 * - 切换时的淡入淡出动画
 */
export function ImagePreviewImage({
  src,
  alt,
  scale,
  rotate = 0,
  flipX = false,
  flipY = false,
  onLoad,
}: ImagePreviewImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const startPositionRef = useRef({ x: 0, y: 0, mouseX: 0, mouseY: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // 切换图片时重置位置
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setIsLoading(true);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad();
  };

  // 鼠标按下开始拖拽
  const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (e.button !== 0) return; // 只响应左键
    e.preventDefault();

    startPositionRef.current = {
      x: position.x,
      y: position.y,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
    setIsMoving(true);
  };

  // 全局鼠标移动
  useEffect(() => {
    if (!isMoving) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPositionRef.current.mouseX;
      const deltaY = e.clientY - startPositionRef.current.mouseY;

      setPosition({
        x: startPositionRef.current.x + deltaX,
        y: startPositionRef.current.y + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsMoving(false);

      // 检查是否需要调整位置
      if (!imgRef.current) return;

      const imgWidth = imgRef.current.offsetWidth * scale;
      const imgHeight = imgRef.current.offsetHeight * scale;
      const clientWidth = window.innerWidth;
      const clientHeight = window.innerHeight;

      // 图片小于视口时，回到中心
      if (imgWidth <= clientWidth && imgHeight <= clientHeight) {
        setPosition({ x: 0, y: 0 });
        return;
      }

      // 图片大于视口时，做边界检查
      const offsetX = (imgWidth - clientWidth) / 2;
      const offsetY = (imgHeight - clientHeight) / 2;

      let fixX = position.x;
      let fixY = position.y;

      if (imgWidth > clientWidth) {
        if (fixX > offsetX) fixX = offsetX;
        else if (fixX < -offsetX) fixX = -offsetX;
      } else {
        fixX = 0;
      }

      if (imgHeight > clientHeight) {
        if (fixY > offsetY) fixY = offsetY;
        else if (fixY < -offsetY) fixY = -offsetY;
      } else {
        fixY = 0;
      }

      setPosition({ x: fixX, y: fixY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isMoving, scale, position.x, position.y]);

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.img
          ref={imgRef}
          key={src}
          src={src}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onLoad={handleLoad}
          className="max-w-full max-h-[90vh] object-contain select-none image-preview-img"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${flipX ? "-" : ""}${scale}, ${flipY ? "-" : ""}${scale}) rotate(${rotate}deg)`,
            transition: isMoving ? "none" : "transform 0.3s ease-out",
            cursor: "grab",
          }}
          onMouseDown={handleMouseDown}
          whileDrag={{ cursor: "grabbing" }}
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
