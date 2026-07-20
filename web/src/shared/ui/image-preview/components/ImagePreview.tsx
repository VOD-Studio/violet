/**
 * 图片预览组件
 * 支持全屏预览、缩放动画、多图切换、键盘操作
 * 类似哔哩哔哩/微信的图片预览效果
 */

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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
    if (typeof window === "undefined") return { x: 0, y: 0, scale: 0.8 };

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
 * 按探测到的比例 + 视口约束(90vw×90vh) 计算 contain 显示盒（确定像素）。
 *
 * 只用于缩略图探测阶段：缩略图与原图同比例、绝对尺寸不同，盒只由比例与
 * 视口决定，保证飞入动画立即有目标盒。原图 natural 尺寸就绪后改用
 * computeNaturalContainBox 修正。
 * 探测到比例后把该 width/height 显式设给容器——
 * 不能用 max-w/max-h（只限上限不放大，配合 absolute 子元素会塌成 0）。
 */
function computeContainBox(naturalW: number, naturalH: number): { width: number; height: number } {
    if (typeof window === "undefined") {
        return { width: naturalW, height: naturalH };
    }

    const maxW = window.innerWidth * VIEWPORT_W_RATIO;
    const maxH = window.innerHeight * VIEWPORT_H_RATIO;
    const ratio = naturalW / naturalH;
    // 视口内按比例的最大盒
    const w1 = maxH * ratio;
    return w1 <= maxW ? { width: w1, height: maxH } : { width: maxW, height: maxW / ratio };
}

/**
 * 判断缩略图探测值是否就是原图 natural 尺寸。
 * 后端 resize 只缩不放（api/internal/infrastructure/image/transformer.go）：
 * - 无缩略图（直接探测原图）→ 是
 * - 缩略图与原图同 URL（GIF 直通，contentImageUrl 原样返回）→ 是
 * - 带 w 参数且返回宽度 < 请求 w（原图比请求档还小，返回的即原图）→ 是
 * 其余只取比例：返回宽度 == 请求 w（仅知原图 ≥ 请求档）、无处理参数的独立
 * 静态缩略文件（如素材管理 xxx_thumb.jpg，尺寸与原图无关），等原图加载完成
 * 再以其 natural 尺寸修正。
 */
function probeYieldsOriginalDims(
    thumb: string | undefined,
    original: string,
    probeWidth: number,
): boolean {
    if (!thumb) return true;
    if (thumb === original) return true;
    const w = Number(new URLSearchParams(thumb.split("?")[1] ?? "").get("w"));
    return w > 0 && probeWidth < w;
}

/**
 * 按原图 natural 尺寸 + 视口约束(90vw×90vh) 计算显示盒：
 * 原图小于视口盒时按原图大小显示（不放大、不失真），大于时按比例 contain 缩小。
 */
function computeNaturalContainBox(
    naturalW: number,
    naturalH: number,
): { width: number; height: number } {
    if (typeof window === "undefined") {
        return { width: naturalW, height: naturalH };
    }

    const maxW = window.innerWidth * VIEWPORT_W_RATIO;
    const maxH = window.innerHeight * VIEWPORT_H_RATIO;
    if (naturalW <= maxW && naturalH <= maxH) {
        return { width: naturalW, height: naturalH };
    }
    return computeContainBox(naturalW, naturalH);
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
    initialNaturalSize,
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

    // 重置时同步清空图片拖拽位置，避免放大拖拽后点重置/双击图片仍停留在偏移位置。
    const [resetKey, setResetKey] = useState(0);
    const handleResetAll = useCallback(() => {
        handleReset();
        setResetKey((prev) => prev + 1);
    }, [handleReset]);

    const initialPosition = getInitialPosition(triggerElement, triggerRect);

    // 当前图是否有可用缩略图（无则回退原图飞入）
    const thumb = thumbnails?.[index];
    const useThumb = !!thumb;

    // 飞入动画是否已稳定（稳定后才开始加载原图，避免与飞入争抢解码资源掉帧）
    const [flyInSettled, setFlyInSettled] = useState(false); // 原图是否加载完成（完成后缩略图+模糊层淡出）
    const [originalLoaded, setOriginalLoaded] = useState(false);
    // 当前图的尺寸来源：缩略图探测（仅比例可信，original=false）或原图
    // （加载完成后回报 natural 尺寸，比例+绝对尺寸都可信，original=true）。
    // 调用方已知首图 natural 尺寸时（initialNaturalSize）直接以此为初始值——
    // 飞入盒即按原图大小显示，不经历缩略图比例视口盒的过渡。
    // index 标记所属图片，切图后旧图尺寸不阻塞新图探测。
    const [dims, setDims] = useState<{
        w: number;
        h: number;
        original: boolean;
        index: number;
    } | null>(() =>
        initialNaturalSize ? { ...initialNaturalSize, original: true, index: currentIndex } : null,
    );
    // resize 重算触发器：setState 驱动重渲染，显示盒随 dims 一并重算
    const [, setViewportTick] = useState(0);
    // 原图目标显示盒（确定像素值）：缩略图阶段按"比例+90vw/90vh"算（飞入立即有目标盒），
    // 原图就绪后按"natural 尺寸+视口上限"修正（小图不被放大拉伸）。
    // 显式设给容器——不能用 max-w/max-h：那只是上限不放大，且配合 absolute 子元素会塌成 0。
    // 缩略图层 h-full/w-full 撑满此盒。
    const box = dims
        ? dims.original
            ? computeNaturalContainBox(dims.w, dims.h)
            : computeContainBox(dims.w, dims.h)
        : null;
    // 缩略图+模糊层是否可见（原图加载完成淡出后隐藏）
    const showThumbLayer = useThumb && !originalLoaded;

    // SSR 安全：createPortal 依赖 document.body，只在客户端挂载后渲染。
    // 同时检测 typeof document，防止 SSR 环境意外进入 portal 分支。
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // flyInSettled 兜底:主触发是飞入动画的 onAnimationComplete,但动画回调并非
    // 可靠事件源——后台标签页 rAF 冻结、动画被中断/跳过时回调不触发,原图会永不
    // 加载,预览永久停在缩略图。超时兜底与回调先到先触发(动画 0.3s + 余量)。
    useEffect(() => {
        if (!open || flyInSettled) return;
        const timer = setTimeout(() => setFlyInSettled(true), 400);
        return () => clearTimeout(timer);
    }, [open, flyInSettled]);

    // 打开/切换图时，探测当前图比例（new Image() 即后台预载），据此推导显示盒。
    // 优先探测缩略图：格子已缓存几乎即时返回，且与原图同比例，盒立即就绪——
    // 原图（可达十几 MB）的下载解码不再阻塞飞入动画。无缩略图回退探测原图。
    // 探测值可直接当原图尺寸用时（probeYieldsOriginalDims）跳过加载后修正，
    // 小图不会先放大到视口盒再缩回原图大小。
    useEffect(() => {
        if (!open) {
            setDims(null);
            return;
        }
        const probe = new Image();
        probe.onload = () => {
            if (probe.naturalWidth && probe.naturalHeight) {
                const fromOriginal = probeYieldsOriginalDims(
                    thumbnails?.[index],
                    images[index],
                    probe.naturalWidth,
                );
                // 同一张图的原图尺寸一旦由加载回调写入，不再被探测值覆盖
                setDims((prev) =>
                    prev && prev.index === index && prev.original
                        ? prev
                        : {
                              w: probe.naturalWidth,
                              h: probe.naturalHeight,
                              original: fromOriginal,
                              index,
                          },
                );
            }
        };
        probe.src = thumbnails?.[index] ?? images[index];
        return () => {
            probe.onload = null;
        };
    }, [open, index, images, thumbnails]);

    // 窗口 resize 时重算显示盒（盒由 dims 推导，这里只需驱动重渲染）
    useEffect(() => {
        const onResize = () => setViewportTick((t) => t + 1);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // 重新打开时重置飞入门控与加载态——上次会话的残留会让 shouldLoad
    // 门控失效(原图与动画并发争抢解码)且占位层不再显示。
    // useLayoutEffect 在 paint 前同步执行,无闪烁;open 保持 true 期间
    // 切换 index 不重置 flyInSettled(飞入只需一次,切图立即加载)。
    useLayoutEffect(() => {
        if (open) {
            setFlyInSettled(false);
            setOriginalLoaded(false);
        }
    }, [open]);

    // 切换图片时同步重置原图加载状态，让缩略图层立即重新显示并覆盖旧图，
    // 避免 paint 前旧图在大图盒左上角闪现。
    // biome-ignore lint/correctness/useExhaustiveDependencies: index 是重置触发器
    useLayoutEffect(() => {
        setOriginalLoaded(false);
    }, [index]);

    // 通过 portal 渲染到 body，脱离父级（如 Radix Dialog Content 的 transform）
    // 创建的 containing block / stacking context，确保 fixed 全屏定位在任意嵌套下都生效。
    if (typeof document === "undefined" || !mounted) return null;

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
                    className="fixed inset-0 z-9999 flex items-center justify-center bg-black/70"
                    // Radix modal Dialog 打开时会把 body 置为 pointer-events:none
                    // （disableOutsidePointerEvents），本组件 portal 在 body 下会被连带
                    // 禁点；显式恢复 auto 保证全屏层可交互（无 Dialog 时等于默认值，无副作用）。
                    style={{ pointerEvents: "auto" }}
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
                        onReset={handleResetAll}
                    />

                    {/* 图片容器（飞入动画作用于此外层；内部缩略图层 + 原图层）。
                        定尺寸关键：用 box 的确定 width/height 显式撑开容器（缩略图阶段按
                        比例+90vw/90vh 算出；原图就绪后按 natural 尺寸+视口上限修正，
                        不靠 max-w/max-h——那只是上限不放大，且配合 absolute 子元素会塌成 0）。
                        缩略图层 h-full/w-full 撑满此盒。
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
                                // 原图 natural 尺寸就绪 / 窗口 resize 时盒会修正，
                                // 加宽高过渡避免跳变（transform 由 motion 驱动，不受影响）
                                transition: "width 0.2s ease, height 0.2s ease",
                                // 飞入未稳定 + 有缩略图层期间，容器不拦截事件，
                                // 避免其几何尺寸覆盖到顶部工具栏导致工具栏点不动。
                                // 原图加载完成后才允许图片拖拽交互。
                                pointerEvents: showThumbLayer && !flyInSettled ? "none" : "auto",
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 缩略图层（绝对覆盖容器；原图加载完成后淡出）。
                                h-full/w-full + object-cover 撑满容器（=原图比例盒）：
                                缩略图与原图同比例时等效填满；异比例（如旧裁方图缓存）
                                居中放大裁切，不拉伸变形。
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
                                            className="h-full w-full select-none object-cover"
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
                                    onLoad={(size) => {
                                        if (useThumb) setOriginalLoaded(true);
                                        // 原图 natural 尺寸可信后以其修正显示盒
                                        // （缩略图探测只提供比例，小图会被放大）
                                        if (size.w > 0 && size.h > 0) {
                                            setDims({
                                                w: size.w,
                                                h: size.h,
                                                original: true,
                                                index,
                                            });
                                        }
                                    }}
                                    onReset={handleResetAll}
                                    onSwipeLeft={handleNext}
                                    onSwipeRight={handlePrevious}
                                    resetKey={resetKey}
                                />
                            </div>
                        </motion.div>
                    ) : null}

                    {/* 缩略图导航:优先用缩略图数组(与原图一一对应),
                        避免多图时底部条拉取全部原图 */}
                    <ImagePreviewThumbnails
                        images={thumbnails ?? images}
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
