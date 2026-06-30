/**
 * 图片预览控制按钮组件
 * 包含顶部工具栏（缩放、旋转、翻转、关闭）和左右切换按钮
 */

import {
    ChevronLeft,
    ChevronRight,
    FlipHorizontal,
    FlipVertical,
    Maximize2,
    RotateCcw,
    RotateCw,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { Button } from "@/shared/ui/button";

/** ImagePreviewControls 组件的属性 */
interface ImagePreviewControlsProps {
    /** 当前缩放比例 */
    scale: number;
    /** 当前图片索引 */
    currentIndex: number;
    /** 图片总数 */
    totalImages: number;
    /** 关闭回调 */
    onClose: () => void;
    /** 放大回调 */
    onZoomIn: () => void;
    /** 缩小回调 */
    onZoomOut: () => void;
    /** 上一张回调 */
    onPrevious: () => void;
    /** 下一张回调 */
    onNext: () => void;
    /** 左旋转回调 */
    onRotateLeft?: () => void;
    /** 右旋转回调 */
    onRotateRight?: () => void;
    /** 水平翻转回调 */
    onFlipX?: () => void;
    /** 垂直翻转回调 */
    onFlipY?: () => void;
    /** 重置（缩放/旋转/翻转恢复初始）回调 */
    onReset?: () => void;
}

/**
 * 图片预览控制按钮组件
 */
export function ImagePreviewControls({
    scale,
    currentIndex,
    totalImages,
    onClose,
    onZoomIn,
    onZoomOut,
    onPrevious,
    onNext,
    onRotateLeft,
    onRotateRight,
    onFlipX,
    onFlipY,
    onReset,
}: ImagePreviewControlsProps) {
    // 阻止事件冒泡
    const handleClick = (callback: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        callback();
    };

    // 阻止事件冒泡：控制区任何点击都不应冒泡到外层（外层 onClick=关闭预览）。
    // 关键：disabled 按钮因 disabled:pointer-events-none 会让点击穿透到外层，
    // 因此必须在容器层拦截，而不是仅靠按钮自身的 stopPropagation。
    // 用 onClickCapture 在捕获阶段拦截，避免 a11y 规则（div 非交互元素不应只有 onClick）。
    const stop = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <>
            {/* 顶部工具栏 */}
            {/* onClickCapture：整个工具栏区域（含 disabled 按钮穿透的点击）都不冒泡 */}
            <div
                onClickCapture={stop}
                className="absolute inset-x-0 top-0 z-50 flex items-center justify-between bg-linear-to-b from-black/50 to-transparent p-4"
            >
                {/* 左侧：缩放、旋转、翻转 */}
                <div className="flex items-center gap-2">
                    {/* 缩放 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClick(onZoomOut)}
                        disabled={scale <= 0.5}
                        className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                    >
                        <ZoomOut className="h-5 w-5" />
                    </Button>
                    <span className="min-w-12.5 text-center text-sm text-white">
                        {Math.round(scale * 100)}%
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClick(onZoomIn)}
                        disabled={scale >= 3}
                        className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                    >
                        <ZoomIn className="h-5 w-5" />
                    </Button>

                    {/* 分隔线 */}
                    <div className="mx-1 h-6 w-px bg-white/20" />

                    {/* 旋转 */}
                    {onRotateLeft ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClick(onRotateLeft)}
                            className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                            title="左旋转"
                        >
                            <RotateCcw className="h-5 w-5" />
                        </Button>
                    ) : null}
                    {onRotateRight ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClick(onRotateRight)}
                            className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                            title="右旋转"
                        >
                            <RotateCw className="h-5 w-5" />
                        </Button>
                    ) : null}

                    {/* 翻转 */}
                    {onFlipX ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClick(onFlipX)}
                            className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                            title="水平翻转"
                        >
                            <FlipHorizontal className="h-5 w-5" />
                        </Button>
                    ) : null}
                    {onFlipY ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClick(onFlipY)}
                            className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                            title="垂直翻转"
                        >
                            <FlipVertical className="h-5 w-5" />
                        </Button>
                    ) : null}

                    {/* 重置（缩放/旋转/翻转恢复初始） */}
                    {onReset ? (
                        <>
                            {/* 分隔线 */}
                            <div className="mx-1 h-6 w-px bg-white/20" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClick(onReset)}
                                className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                                title="重置（也可双击图片）"
                            >
                                <Maximize2 className="h-5 w-5" />
                            </Button>
                        </>
                    ) : null}
                </div>

                {/* 右侧：图片计数、关闭 */}
                <div className="flex items-center gap-2">
                    {totalImages > 1 ? (
                        <span className="text-sm text-white">
                            {currentIndex + 1} / {totalImages}
                        </span>
                    ) : null}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClick(onClose)}
                        className="text-white hover:bg-white/15 hover:text-white active:scale-100"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* 左右切换按钮：每个按钮自身也 stopPropagation，防 disabled 穿透 */}
            {totalImages > 1 ? (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClick(onPrevious)}
                        className="absolute top-1/2 left-4 z-50 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white active:translate-y-[-50%]!"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClick(onNext)}
                        className="absolute top-1/2 right-4 z-50 h-12 w-12 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white active:translate-y-[-50%]!"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                </>
            ) : null}
        </>
    );
}
