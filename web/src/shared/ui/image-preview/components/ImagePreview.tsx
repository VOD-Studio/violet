/**
 * 图片预览组件
 * 支持全屏预览、缩放动画、多图切换、键盘操作
 * 类似哔哩哔哩/微信的图片预览效果
 */

import { AnimatePresence, motion } from "motion/react";
import { createPortal } from "react-dom";
import { useImagePreviewControls } from "../hooks/useImagePreviewControls";
import type { ImagePreviewProps } from "../types/image-preview-types";
import { ImagePreviewControls } from "./ImagePreviewControls";
import { ImagePreviewImage } from "./ImagePreviewImage";
import { ImagePreviewThumbnails } from "./ImagePreviewThumbnails";

/**
 * 计算动画起点位置
 * 用于实现从触发元素到全屏的平滑过渡动画
 */
function getInitialPosition(triggerElement?: HTMLElement | null, triggerRect?: DOMRect | null) {
    // 优先用调用方快照的 rect（触发元素可能已被卸载，运行时读不到正确位置）
    const rect = triggerRect ?? triggerElement?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, scale: 0.8 };

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
    triggerRect,
    onExitComplete,
}: ImagePreviewProps) {
    const {
        index,
        scale,
        rotate,
        flipX,
        flipY,
        setIndex,
        handlePrevious,
        handleNext,
        handleZoomIn,
        handleZoomOut,
        handleRotateLeft,
        handleRotateRight,
        handleFlipX,
        handleFlipY,
        handleReset,
    } = useImagePreviewControls({
        open,
        images,
        currentIndex,
        onIndexChange,
        onClose,
    });

    const initialPosition = getInitialPosition(triggerElement, triggerRect);

    // 通过 portal 渲染到 body，脱离父级（如 Radix Dialog Content 的 transform）
    // 创建的 containing block / stacking context，确保 fixed 全屏定位在任意嵌套下都生效。
    return createPortal(
        <AnimatePresence onExitComplete={onExitComplete}>
            {open ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    // 与图片的 transform 动画时长一致（0.3s），避免遮罩先于图片完成
                    // 造成"先黑后飞"的割裂闪烁感
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/95"
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
                        onRotateLeft={handleRotateLeft}
                        onRotateRight={handleRotateRight}
                        onFlipX={handleFlipX}
                        onFlipY={handleFlipY}
                        onReset={handleReset}
                    />

                    {/* 图片容器 */}
                    {/* 进入/退出动画仅作用于 transform（GPU 合成层属性，不触发 reflow），
                        配合 will-change 提升，避免与图片加载过程中的布局变化相互干扰导致掉帧。 */}
                    <motion.div
                        initial={{
                            x: initialPosition.x,
                            y: initialPosition.y,
                            scale: initialPosition.scale,
                            opacity: 0,
                        }}
                        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                        exit={{
                            x: initialPosition.x,
                            y: initialPosition.y,
                            scale: initialPosition.scale,
                            opacity: 0,
                        }}
                        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                        className="relative max-h-[90vh] max-w-[90vw]"
                        style={{ willChange: "transform, opacity" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ImagePreviewImage
                            src={images[index]}
                            alt={`预览图片 ${index + 1}`}
                            scale={scale}
                            rotate={rotate}
                            flipX={flipX}
                            flipY={flipY}
                            onLoad={() => {}}
                            onReset={handleReset}
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
            ) : null}
        </AnimatePresence>,
        document.body,
    );
}
