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
	/** 加载完成回调（decode 就绪后触发，携带原图 natural 尺寸；读不到时为 0） */
	onLoad: (size: { w: number; h: number }) => void;
	/** 是否显示加载指示器（默认 true；当外层已有缩略图占位时传 false，避免双重加载指示） */
	showSpinner?: boolean;
	/** 双击图片重置（缩放/旋转/翻转恢复初始）回调 */
	onReset?: () => void;
	/** 水平轻扫切换图片的回调 */
	onSwipeLeft?: () => void;
	/** 水平轻扫切换图片的回调 */
	onSwipeRight?: () => void;
	/** 轻扫触发阈值（像素，默认 50） */
	swipeThreshold?: number;
	/** 重置信号：变化时强制将拖拽位置恢复到中心 */
	resetKey?: number;
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
	showSpinner = true,
	onReset,
	onSwipeLeft,
	onSwipeRight,
	swipeThreshold = 50,
	resetKey,
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
		if (!shouldLoad) return;
		setIsLoading(true);
		// 兜底：图片命中缓存时会在事件绑定前完成加载，导致 onLoad 丢失、永久 loading。
		// 若新 <img> 已解码完成，同步置为完成态。
		const img = imgRef.current;
		if (img?.complete && img.naturalWidth !== 0) {
			handleLoad();
		}
	}, [src, shouldLoad]);

	// 外部触发重置（缩放/旋转/翻转恢复初始）时，同步清空拖拽偏移，让图片回到中心。
	// biome-ignore lint/correctness/useExhaustiveDependencies: resetKey 是父组件传入的重置信号，必须作为依赖
	useEffect(() => {
		setPosition({ x: 0, y: 0 });
	}, [resetKey]);

	const handleLoad = () => {
		// load 只代表下载完成,图片可能尚未解码上屏;此刻上报会让外层淡出
		// 缩略图占位,原图区域透明,透出遮罩与后方页面排版。等 decode 确保
		// 像素就绪再上报;decode 不可用/失败也要上报,避免永久卡在占位层。
		const img = imgRef.current;
		const report = () => {
			setIsLoading(false);
			// 回报原图 natural 尺寸,外层据此把显示盒修正为原图大小
			onLoad({ w: img?.naturalWidth ?? 0, h: img?.naturalHeight ?? 0 });
		};
		if (img?.decode) {
			img.decode().then(report, report);
		} else {
			report();
		}
	};

	// 鼠标按下开始拖拽
	const handleMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
		if (e.button !== 0) return; // 只响应左键
		e.preventDefault();
		startDrag(e.clientX, e.clientY);
	};

	// 触摸开始拖拽
	const handleTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
		if (e.touches.length !== 1) return;
		startDrag(e.touches[0].clientX, e.touches[0].clientY);
	};

	const startDrag = (clientX: number, clientY: number) => {
		startPositionRef.current = {
			x: position.x,
			y: position.y,
			mouseX: clientX,
			mouseY: clientY,
		};
		setIsMoving(true);
	};

	// 拖拽结束后的边界吸附
	const snapToBounds = () => {
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

	// 全局鼠标/触摸移动
	// biome-ignore lint/correctness/useExhaustiveDependencies: 事件订阅与拖拽状态同步，依赖项由调用方保证稳定
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

		const handleTouchMove = (e: TouchEvent) => {
			if (e.touches.length !== 1) return;
			e.preventDefault();
			const touch = e.touches[0];
			const deltaX = touch.clientX - startPositionRef.current.mouseX;
			const deltaY = touch.clientY - startPositionRef.current.mouseY;

			setPosition({
				x: startPositionRef.current.x + deltaX,
				y: startPositionRef.current.y + deltaY,
			});
		};

		const handleMouseUp = () => {
			setIsMoving(false);
			snapToBounds();
		};

		const handleTouchEnd = (e: TouchEvent) => {
			setIsMoving(false);

			// 未缩放时识别水平轻扫切换图片
			const touch = e.changedTouches[0];
			if (touch && scale <= 1) {
				const deltaX = touch.clientX - startPositionRef.current.mouseX;
				const deltaY = touch.clientY - startPositionRef.current.mouseY;
				if (Math.abs(deltaX) > swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
					if (deltaX > 0) {
						onSwipeRight?.();
					} else {
						onSwipeLeft?.();
					}
					// 轻扫触发切换后不再执行边界吸附
					return;
				}
			}

			snapToBounds();
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("touchmove", handleTouchMove, { passive: false });
		window.addEventListener("touchend", handleTouchEnd);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
		};
	}, [isMoving, scale, position.x, position.y]);

	return (
		<div className="relative h-full w-full">
			<AnimatePresence mode="wait">
				{shouldLoad && (
					<motion.img
						ref={imgRef}
						key={src}
						src={shouldLoad ? src : undefined}
						alt={alt}
						// 无占位层时(showSpinner)图片带 opacity 0→1 淡入，避免硬切。
						// 有缩略图占位覆盖时必须直接不透明挂载：视觉连续由占位层负责，
						// 原图淡入没有意义——缓存命中时 onLoad 同步触发，占位层淡出
						// 会与此淡入重叠，两层叠加透明度 <1，透出遮罩与后方排版。
						// 加载态由下方的 spinner 覆盖层指示，不靠图片透明度。
						initial={{ opacity: showSpinner ? 0 : 1 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onLoad={handleLoad}
						className="absolute inset-0 h-full w-full select-none object-contain"
						style={{
							transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${flipX ? "-" : ""}${scale}, ${flipY ? "-" : ""}${scale}) rotate(${rotate}deg)`,
							transition: isMoving ? "none" : "transform 0.3s ease-out",
							cursor: "grab",
							touchAction: "none",
						}}
						onMouseDown={handleMouseDown}
						onTouchStart={handleTouchStart}
						onDoubleClick={onReset}
						whileDrag={{ cursor: "grabbing" }}
						draggable={false}
					/>
				)}
			</AnimatePresence>

			{/* 加载指示器（外层有缩略图占位时关闭，避免双重加载指示） */}
			{showSpinner && isLoading ? (
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
				</div>
			) : null}
		</div>
	);
}
