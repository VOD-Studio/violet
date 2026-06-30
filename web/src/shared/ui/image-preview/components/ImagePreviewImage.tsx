/**
 * 图片显示组件
 * 负责图片的加载、缩放、拖拽和动画效果
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** ImagePreviewImage 组件的属性 */
interface ImagePreviewImageProps {
    /** 图片地址 */
    src: string;
    /** 是否开始加载（false 时不设置 src，不发起请求；用于飞入动画稳定后再加载原图） */
    shouldLoad?: boolean;
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
    /** 双击图片重置（缩放/旋转/翻转恢复初始）回调 */
    onReset?: () => void;
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
    shouldLoad = true,
    alt,
    scale,
    rotate = 0,
    flipX = false,
    flipY = false,
    onLoad,
    onReset,
}: ImagePreviewImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isMoving, setIsMoving] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const startPositionRef = useRef({ x: 0, y: 0, mouseX: 0, mouseY: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    // 切换图片时重置位置
    // biome-ignore lint/correctness/useExhaustiveDependencies: src 是重置触发器，函数体内未直接使用
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
                    src={shouldLoad ? src : undefined}
                    alt={alt}
                    initial={{ opacity: 0 }}
                    // 图片始终参与外层飞入动画的透明度过渡，不等待 isLoading。
                    // 否则打开时图片先透明、onLoad 后才显现，与飞入动画错位造成"闪一下"。
                    // 加载态由下方的 spinner 覆盖层指示，不靠图片透明度。
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onLoad={handleLoad}
                    className="max-h-[90vh] max-w-full select-none object-contain"
                    style={{
                        transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${flipX ? "-" : ""}${scale}, ${flipY ? "-" : ""}${scale}) rotate(${rotate}deg)`,
                        transition: isMoving ? "none" : "transform 0.3s ease-out",
                        cursor: "grab",
                    }}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={onReset}
                    whileDrag={{ cursor: "grabbing" }}
                    draggable={false}
                />
            </AnimatePresence>

            {/* 加载指示器 */}
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                </div>
            ) : null}
        </div>
    );
}
