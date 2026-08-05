/**
 * 图片预览控制按钮组件
 * 包含顶部工具栏（缩放、旋转、翻转、关闭）和左右切换按钮
 */

import {
	ChevronLeft,
	ChevronRight,
	FlipHorizontal,
	FlipVertical,
	RefreshCcw,
	RotateCcw,
	RotateCw,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/shared/ui/base/button";

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
	// 必须用 onClick（冒泡阶段）而非 onClickCapture：在 capture 阶段调 stopPropagation 会
	// 同时阻止 target 阶段与冒泡阶段，导致按钮自身的 onClick 永远不触发（点了没反应）。
	// 用冒泡阶段：按钮 onClick 先在 target 触发，再冒泡到此处被拦截，不再到外层 onClose。

	return (
		<>
			{/* 顶部工具栏 */}
			{/* onClick：整个工具栏区域（含 disabled 按钮穿透的点击）都不冒泡到外层关闭；真正的键盘交互由内部按钮提供 */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 纯事件拦截容器（含 disabled 按钮穿透的点击），无点击语义，键盘交互由内部按钮提供 */}
			<div
				onClick={(e) => e.stopPropagation()}
				className="absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-2 bg-linear-to-b from-black/50 to-transparent p-2 sm:p-4"
			>
				{/* 左侧：缩放、旋转、翻转 */}
				<div className="flex min-w-0 items-center gap-1 sm:gap-2">
					{/* 缩放 */}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleClick(onZoomOut)}
						disabled={scale <= 0.5}
						className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
					>
						<ZoomOut className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>
					<span className="min-w-10 shrink-0 text-center text-xs text-white sm:min-w-12.5 sm:text-sm">
						{Math.round(scale * 100)}%
					</span>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleClick(onZoomIn)}
						disabled={scale >= 3}
						className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
					>
						<ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>

					{/* 分隔线 */}
					<div className="mx-0.5 h-5 w-px bg-white/20 sm:mx-1 sm:h-6" />

					{/* 旋转 */}
					{onRotateLeft ? (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleClick(onRotateLeft)}
							className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
							title="左旋转"
						>
							<RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />
						</Button>
					) : null}
					{onRotateRight ? (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleClick(onRotateRight)}
							className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
							title="右旋转"
						>
							<RotateCw className="h-4 w-4 sm:h-5 sm:w-5" />
						</Button>
					) : null}

					{/* 翻转 */}
					{onFlipX ? (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleClick(onFlipX)}
							className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
							title="水平翻转"
						>
							<FlipHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
						</Button>
					) : null}
					{onFlipY ? (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={handleClick(onFlipY)}
							className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
							title="垂直翻转"
						>
							<FlipVertical className="h-4 w-4 sm:h-5 sm:w-5" />
						</Button>
					) : null}

					{/* 重置（缩放/旋转/翻转恢复初始） */}
					{onReset ? (
						<>
							{/* 分隔线 */}
							<div className="mx-0.5 h-5 w-px bg-white/20 sm:mx-1 sm:h-6" />
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleClick(onReset)}
								className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
								title="重置（也可双击图片）"
							>
								<RefreshCcw className="h-4 w-4 sm:h-5 sm:w-5" />
							</Button>
						</>
					) : null}
				</div>

				{/* 右侧：图片计数、关闭 */}
				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					{totalImages > 1 ? (
						<span className="text-xs text-white sm:text-sm">
							{currentIndex + 1} / {totalImages}
						</span>
					) : null}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleClick(onClose)}
						className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
					>
						<X className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>
				</div>
			</div>

			{/* 左右切换按钮：移动端隐藏，使用滑动手势/缩略图切换；桌面端显示 */}
			{totalImages > 1 ? (
				<>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleClick(onPrevious)}
						className="absolute top-1/2 left-2 z-50 hidden h-10 w-10 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white active:translate-y-[-50%]! sm:left-4 sm:flex sm:h-12 sm:w-12"
					>
						<ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={handleClick(onNext)}
						className="absolute top-1/2 right-2 z-50 hidden h-10 w-10 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white active:translate-y-[-50%]! sm:right-4 sm:flex sm:h-12 sm:w-12"
					>
						<ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
					</Button>
				</>
			) : null}
		</>
	);
}
