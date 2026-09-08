import {
	ChevronLeft,
	ChevronRight,
	FlipHorizontal,
	FlipVertical,
	List,
	RefreshCcw,
	RotateCcw,
	RotateCw,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/shared/ui/base/button";

/** 图片查看器工具栏与循环导航的操作契约。 */
export interface ImagePreviewControlsProps {
	/** 实际倍率，1 表示适配视口后的尺寸。 */
	scale: number;
	/** 从 0 开始。 */
	currentIndex: number;
	totalImages: number;
	/** 是否显示缩略图列表。 */
	listVisible: boolean;
	onClose: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onPrevious: () => void;
	onNext: () => void;
	onRotateLeft?: () => void;
	onRotateRight?: () => void;
	onFlipX?: () => void;
	onFlipY?: () => void;
	/** 切换缩略图列表显示状态。 */
	onToggleList: () => void;
	/** 重置（缩放/旋转/翻转恢复初始）回调 */
	onReset?: () => void;
}

/** 提供图片变换、关闭与循环导航操作。 */
export function ImagePreviewControls({
	scale,
	currentIndex,
	totalImages,
	listVisible,
	onClose,
	onZoomIn,
	onZoomOut,
	onPrevious,
	onNext,
	onRotateLeft,
	onRotateRight,
	onFlipX,
	onFlipY,
	onToggleList,
	onReset,
}: ImagePreviewControlsProps) {
	const handleClick = (callback: () => void) => (e: React.MouseEvent) => {
		e.stopPropagation();
		callback();
	};

	// disabled 按钮会穿透点击，由无交互语义的外层统一阻止关闭预览。

	return (
		<>
			{/* 顶部工具栏 */}
			<div
				role="presentation"
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
						<>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleClick(onToggleList)}
								aria-label={listVisible ? "收起图片列表" : "显示图片列表"}
								aria-expanded={listVisible}
								aria-controls="image-preview-list"
								className="text-white hover:bg-white/15 hover:text-white active:scale-100 sm:size-9"
							>
								<List className="h-4 w-4 sm:h-5 sm:w-5" />
							</Button>
							<span className="text-xs text-white sm:text-sm">
								{currentIndex + 1} / {totalImages}
							</span>
						</>
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
