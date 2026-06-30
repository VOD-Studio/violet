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

/** 视口约束：图片最大占 90vw × 90vh */
const VIEWPORT_W_RATIO = 0.9;
const VIEWPORT_H_RATIO = 0.9;

/**
 * 按原图 natural 尺寸 + 视口约束(90vw×90vh) 计算 contain 显示盒（确定像素）。
 *
 * contain 真实语义：保持比例、不超过视口、**也不超过原图 natural**（小图不放大）。
 * 探测原图 natural 后算出原图将占据的显示盒，把该 width/height 显式设给容器——
 * 不能用 max-w/max-h（只限上限不放大，配合 absolute 子元素会塌成 0）。
 */
function computeContainBox(
    naturalW: number,
    naturalH: number,
): { width: number; height: number } {
    const maxW = window.innerWidth * VIEWPORT_W_RATIO;
    const maxH = window.innerHeight * VIEWPORT_H_RATIO;
    const ratio = naturalW / naturalH;
    // 视口内按比例的最大盒
    const w1 = maxH * ratio;
    const fit = w1 <= maxW ? { width: w1, height: maxH } : { width: maxW, height: maxW / ratio };
    // contain：不超过原图 natural（小图不放大）
    return {
        width: Math.min(fit.width, naturalW),
        height: Math.min(fit.height, naturalH),
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
    // 原图 natural 尺寸（探测原图得到）。据此算原图 contain 盒撑开容器。
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    // 原图目标显示盒（确定像素值）。用原图 natural + 视口约束(90vw/90vh) 按 contain 算出，
    // 显式设给容器——不能用 max-w/max-h：那只是上限不放大，且配合 absolute 子元素会塌成 0。
    // 缩略图层 h-full/w-full 撑满此盒，从而"缩略图显示成原图大小"。
    const [box, setBox] = useState<{ width: number; height: number } | null>(null);
    // 缩略图+模糊层是否可见（原图加载完成淡出后隐藏）
    const showThumbLayer = useThumb && !originalLoaded;

    // 打开/切换图时，立刻探测原图 natural size（new Image() 即后台预载原图），
    // 据此算出原图目标显示盒。原图加载完（onload）即缓存命中，<img> 秒显替换缩略图。
    useEffect(() => {
        if (!open || !useThumb || !thumb) {
            setNaturalSize(null);
            setBox(null);
            return;
        }
        const probe = new Image();
        probe.onload = () => {
            if (probe.naturalWidth && probe.naturalHeight) {
                setNaturalSize({ w: probe.naturalWidth, h: probe.naturalHeight });
                setBox(computeContainBox(probe.naturalWidth, probe.naturalHeight));
            }
        };
        probe.src = images[index];
        return () => {
            probe.onload = null;
        };
    }, [open, useThumb, thumb, index, images]);

    // 原图尺寸已知后响应窗口 resize 重算盒
    useEffect(() => {
        if (naturalSize == null) return;
        const onResize = () => setBox(computeContainBox(naturalSize.w, naturalSize.h));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [naturalSize]);

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

                    {/* 图片容器（飞入动画作用于此外层；内部缩略图层 + 原图层）。
                        定尺寸关键：用 box 的确定 width/height 显式撑开容器（JS 按原图比例
                        + 90vw/90vh 算出，不靠 max-w/max-h——那只是上限不放大，且配合 absolute
                        子元素会塌成 0）。缩略图层 h-full/w-full 撑满此盒，故缩略图显示成原图大小。
                        box 未就绪（缩略图比例未探测到）时不渲染容器，避免 0×0 闪现。
                        进入/退出动画仅作用于 transform（GPU 合成层属性，不触发 reflow）。 */}
                    {box ? (
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
                            className="relative"
                            style={{
                                width: box.width,
                                height: box.height,
                                willChange: "transform, opacity",
                                // 飞入未稳定 + 有缩略图层期间，容器不拦截事件，
                                // 避免其几何尺寸覆盖到顶部工具栏导致工具栏点不动。
                                // 原图加载完成后才允许图片拖拽交互。
                                pointerEvents: showThumbLayer && !flyInSettled ? "none" : "auto",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 缩略图层（绝对覆盖容器；原图加载完成后淡出）。
                                h-full/w-full + object-fill 撑满容器（=原图盒），
                                从而缩略图被拉伸显示成原图大小。
                                AnimatePresence + motion.div：原图 onLoad 后整体淡出，
                                与原图淡入交叉过渡，而非硬切消失。 */}
                            <AnimatePresence>
                                {showThumbLayer ? (
                                    <motion.div
                                        initial={{ opacity: 1 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="absolute inset-0"
                                    >
                                        <img
                                            src={thumb}
                                            alt=""
                                            aria-hidden
                                            className="h-full w-full select-none object-fill"
                                            draggable={false}
                                        />
                                        {/* 模糊层：覆盖拉伸后的缩略图盒 */}
                                        <div
                                            className="absolute inset-0 bg-black/5 backdrop-blur-sm"
                                            aria-hidden
                                        />
                                    </motion.div>
                                ) : null}
                            </AnimatePresence>

                            {/* 原图层（绝对覆盖容器，与缩略图层盒重合）。
                                h-full/w-full 撑满同一容器，与缩略图同盒，替换无尺寸跳变。
                                shouldLoad 门控：飞入动画稳定后才开始加载原图。
                                useThumb 时关闭 spinner——缩略图层本身即是加载占位，
                                避免模糊缩略图上再叠一个转圈的双重指示。 */}
                            <div className="absolute inset-0">
                                <ImagePreviewImage
                                    src={images[index]}
                                    alt={`预览图片 ${index + 1}`}
                                    shouldLoad={!useThumb || flyInSettled}
                                    showSpinner={!useThumb}
                                    scale={scale}
                                    rotate={rotate}
                                    flipX={flipX}
                                    flipY={flipY}
                                    onLoad={() => {
                                        if (useThumb) setOriginalLoaded(true);
                                    }}
                                    onReset={handleReset}
                                />
                            </div>
                        </motion.div>
                    ) : null}

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
