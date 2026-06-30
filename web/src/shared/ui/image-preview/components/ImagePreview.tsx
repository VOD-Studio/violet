/**
 * 图片预览组件
 * 支持全屏预览、缩放动画、多图切换、键盘操作
 * 类似哔哩哔哩/微信的图片预览效果
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
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
    thumbnails,
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

    // 当前图是否有可用缩略图（无则回退原图飞入）
    const thumb = thumbnails?.[index];
    const useThumb = !!thumb;

    // 飞入动画是否已稳定（稳定后才开始加载原图，避免与飞入争抢解码资源掉帧）
    const [flyInSettled, setFlyInSettled] = useState(false);
    // 原图是否加载完成（完成后缩略图+模糊层淡出）
    const [originalLoaded, setOriginalLoaded] = useState(false);
    // 缩略图+模糊层是否可见（原图加载完成淡出后隐藏）
    const showThumbLayer = useThumb && !originalLoaded;

    // 切换图片时重置渐进加载状态
    // biome-ignore lint/correctness/useExhaustiveDependencies: index 是重置触发器
    useEffect(() => {
        setFlyInSettled(false);
        setOriginalLoaded(false);
    }, [index]);

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

                    {/* 图片容器（飞入动画作用于此外层；内部缩略图层 + 原图层） */}
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
                        onAnimationComplete={() => setFlyInSettled(true)}
                        className="relative max-h-[90vh] max-w-[90vw]"
                        style={{
                            willChange: "transform, opacity",
                            // 飞入未稳定 + 有缩略图层期间，容器不拦截事件，
                            // 避免其几何尺寸覆盖到顶部工具栏导致工具栏点不动。
                            // 原图加载完成后才允许图片拖拽交互。
                            pointerEvents: showThumbLayer && !flyInSettled ? "none" : "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 缩略图层（飞入阶段可见；原图加载完成后淡出）。
                            用与原图相同的 contain 约束渲染，因后端缩略图等比缩放、
                            宽高比与原图一致，盒自然重合，替换无尺寸跳变。 */}
                        {showThumbLayer ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <img
                                    src={thumb}
                                    alt=""
                                    aria-hidden
                                    className="max-h-[90vh] max-w-full select-none object-contain"
                                    draggable={false}
                                />
                                {/* 模糊层：覆盖拉伸后的缩略图盒 */}
                                <div
                                    className="absolute inset-0 bg-black/5 backdrop-blur-xl"
                                    aria-hidden
                                />
                            </div>
                        ) : null}

                        {/* 原图层：飞入动画稳定后才开始加载（shouldLoad 门控） */}
                        <ImagePreviewImage
                            src={images[index]}
                            alt={`预览图片 ${index + 1}`}
                            shouldLoad={!useThumb || flyInSettled}
                            scale={scale}
                            rotate={rotate}
                            flipX={flipX}
                            flipY={flipY}
                            onLoad={() => {
                                if (useThumb) setOriginalLoaded(true);
                            }}
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
