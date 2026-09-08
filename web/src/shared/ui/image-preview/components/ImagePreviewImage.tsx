import {
	AnimatePresence,
	animate,
	type MotionValue,
	motion,
	useIsPresent,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type PointerEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** 单张图片的加载、独立尺寸与手势契约。 */
export interface ImagePreviewImageProps {
	src: string;
	alt: string;
	thumbnail?: string;
	/** -1 向前、1 向后，0 为打开预览。 */
	direction: number;
	triggerRect?: DOMRect | null;
	closeProgress: MotionValue<number>;
	initialNaturalSize?: { w: number; h: number } | null;
	/** 原图尺寸未知时用于预留显示盒，避免缩略图先小后大。 */
	placeholderAspectRatio?: number;
	scale: number;
	rotate: number;
	flipX: boolean;
	flipY: boolean;
	/** 原图解码完成后触发。 */
	onLoad: () => void;
	onReset: () => void;
	/** 已换算为像素的垂直滚动增量；首次方向用于收回，反向用于恢复。 */
	onWheelFollow: (deltaY: number) => void;
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	resetKey: number;
}

interface Gesture {
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	mode: "pending" | "swipe" | "pan" | "vertical";
}

const slideVariants = {
	enter: (direction: number) => ({ x: `${direction * 100}%` }),
	center: { x: "0%" },
	exit: (direction: number) => ({ x: `${-direction * 100}%` }),
};

/** 每张图独立持有加载状态和显示盒，退场期间不接收下一张的尺寸。 */
export function ImagePreviewImage({
	src,
	alt,
	thumbnail,
	direction,
	triggerRect,
	closeProgress,
	initialNaturalSize,
	placeholderAspectRatio,
	scale,
	rotate,
	flipX,
	flipY,
	onLoad,
	onReset,
	onWheelFollow,
	onSwipeLeft,
	onSwipeRight,
	resetKey,
}: ImagePreviewImageProps) {
	const isPresent = useIsPresent();
	const reducedMotion = useReducedMotion();
	const [probedSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
	const naturalSize = initialNaturalSize ?? probedSize;
	const [ready, setReady] = useState(false);
	const [failed, setFailed] = useState(false);
	const [viewport, setViewport] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));
	const imgRef = useRef<HTMLImageElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const wheelActive = useRef(false);
	const decodingImage = useRef<HTMLImageElement | null>(null);
	const active = useRef(true);
	const gesture = useRef<Gesture | null>(null);
	const dragged = useRef(false);
	const imagePressed = useRef(false);
	const offsetX = useMotionValue(0);
	const offsetY = useMotionValue(0);

	useLayoutEffect(() => {
		active.current = isPresent;
		if (isPresent) {
			gesture.current = null;
			offsetX.stop();
			offsetY.stop();
			offsetX.set(0);
			offsetY.set(0);
		}
		return () => {
			active.current = false;
		};
	}, [isPresent, offsetX, offsetY]);

	useEffect(() => {
		if (initialNaturalSize) return;
		const image = new Image();
		image.decoding = "async";
		const handleSize = () => {
			if (image.naturalWidth > 0 && image.naturalHeight > 0) {
				setNaturalSize({ w: image.naturalWidth, h: image.naturalHeight });
			}
		};
		image.onload = handleSize;
		image.onerror = () => setFailed(true);
		image.src = src;
		if (image.complete) handleSize();
		return () => {
			image.onload = null;
			image.onerror = null;
		};
	}, [src, initialNaturalSize]);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || !isPresent) return;
		const followWheel = (event: WheelEvent) => {
			event.preventDefault();
			wheelActive.current = true;
			onWheelFollow(
				event.deltaY *
					(event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1),
			);
		};
		stage.addEventListener("wheel", followWheel, { passive: false });
		return () => stage.removeEventListener("wheel", followWheel);
	}, [isPresent, onWheelFollow]);

	useEffect(() => {
		const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, []);

	const fallbackAspectRatio =
		placeholderAspectRatio ??
		(triggerRect && triggerRect.width > 0 && triggerRect.height > 0
			? triggerRect.width / triggerRect.height
			: null);
	const sizingBasis =
		naturalSize ??
		(fallbackAspectRatio && Number.isFinite(fallbackAspectRatio)
			? { w: fallbackAspectRatio, h: 1 }
			: null);
	const fit = sizingBasis
		? Math.min(
				naturalSize ? 1 : Number.POSITIVE_INFINITY,
				(viewport.width * 0.9) / sizingBasis.w,
				(viewport.height * 0.9) / sizingBasis.h,
			)
		: 1;
	const box = sizingBasis ? { width: sizingBasis.w * fit, height: sizingBasis.h * fit } : null;

	const handleLoad = useCallback(() => {
		const image = imgRef.current;
		if (!image || decodingImage.current === image) return;
		decodingImage.current = image;
		const report = () => {
			if (imgRef.current !== image) return;
			setReady(true);
			if (active.current) onLoad();
		};
		// 下载完成不等于像素已就绪，占位层必须等 decode 后才能退场。
		if (image.decode) image.decode().then(report, report);
		else report();
	}, [onLoad]);

	useEffect(() => {
		const image = imgRef.current;
		if (!ready && image?.complete && image.naturalWidth > 0) handleLoad();
	}, [ready, handleLoad]);

	const settle = useCallback(() => {
		const radians = (rotate * Math.PI) / 180;
		const width = (box?.width ?? 0) * scale;
		const height = (box?.height ?? 0) * scale;
		const rotatedWidth =
			Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
		const rotatedHeight =
			Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
		const maxX = Math.max(0, (rotatedWidth - viewport.width) / 2);
		const maxY = Math.max(0, (rotatedHeight - viewport.height) / 2);
		const duration = reducedMotion ? 0 : 0.2;
		animate(offsetX, Math.max(-maxX, Math.min(maxX, offsetX.get())), { duration });
		animate(offsetY, Math.max(-maxY, Math.min(maxY, offsetY.get())), { duration });
	}, [box?.width, box?.height, scale, rotate, viewport, reducedMotion, offsetX, offsetY]);

	const previousReset = useRef(resetKey);
	useLayoutEffect(() => {
		if (previousReset.current === resetKey) return;
		previousReset.current = resetKey;
		gesture.current = null;
		offsetX.stop();
		offsetY.stop();
		offsetX.set(0);
		offsetY.set(0);
	}, [resetKey, offsetX, offsetY]);

	const cancelGesture = () => {
		if (!gesture.current) return;
		gesture.current = null;
		settle();
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || !isPresent) return;
		if (!event.isPrimary) {
			dragged.current = true;
			cancelGesture();
			return;
		}
		offsetX.stop();
		offsetY.stop();
		dragged.current = false;
		imagePressed.current =
			event.target instanceof Element && !!event.target.closest("[data-preview-frame]");
		gesture.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: offsetX.get(),
			originY: offsetY.get(),
			mode: scale > 1 ? "pan" : "pending",
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (wheelActive.current) wheelActive.current = false;
		const current = gesture.current;
		if (!current || current.pointerId !== event.pointerId) return;
		const x = event.clientX - current.startX;
		const y = event.clientY - current.startY;
		if (Math.max(Math.abs(x), Math.abs(y)) < 8 && !dragged.current) return;
		dragged.current = true;
		if (current.mode === "pending") {
			current.mode = Math.abs(x) > Math.abs(y) * 1.2 ? "swipe" : "vertical";
		}
		if (current.mode === "pan") {
			offsetX.set(current.originX + x);
			offsetY.set(current.originY + y);
		} else if (current.mode === "swipe" && (onSwipeLeft || onSwipeRight)) {
			offsetX.set(x);
		}
	};

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		const current = gesture.current;
		if (!current || current.pointerId !== event.pointerId) return;
		gesture.current = null;
		if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		const deltaX = event.clientX - current.startX;
		const threshold = Math.min(80, viewport.width * 0.15);
		if (current.mode === "swipe" && Math.abs(deltaX) >= threshold) {
			const navigate = deltaX < 0 ? onSwipeLeft : onSwipeRight;
			if (navigate) {
				navigate();
				return;
			}
		}
		settle();
	};

	const origin =
		box && triggerRect && triggerRect.width > 0 && triggerRect.height > 0
			? {
					x: triggerRect.left + triggerRect.width / 2 - viewport.width / 2,
					y: triggerRect.top + triggerRect.height / 2 - viewport.height / 2,
					scale: Math.min(triggerRect.width / box.width, triggerRect.height / box.height),
				}
			: { x: 0, y: 0, scale: 1 };

	const imageCloseProgress = useTransform(closeProgress, (progress) =>
		isPresent ? progress : 0,
	);
	const returnX = useTransform(() => {
		const progress = imageCloseProgress.get();
		return offsetX.get() * (1 - progress) + origin.x * progress;
	});
	const returnY = useTransform(() => {
		const progress = imageCloseProgress.get();
		return offsetY.get() * (1 - progress) + origin.y * progress;
	});
	const returnScale = useTransform(
		imageCloseProgress,
		(progress) => 1 + ((triggerRect ? origin.scale : 0.85) - 1) * progress,
	);
	const returnOpacity = useTransform(imageCloseProgress, (progress) =>
		triggerRect ? 1 : 1 - progress,
	);
	const imageTransform = useTransform(imageCloseProgress, (progress) => {
		const x = (flipX ? -scale : scale) * (1 - progress) + progress;
		const y = (flipY ? -scale : scale) * (1 - progress) + progress;
		return `scale(${x}, ${y}) rotate(${rotate * (1 - progress)}deg)`;
	});
	const imageTransition = useTransform(imageCloseProgress, (progress) =>
		reducedMotion || progress > 0 ? "none" : "transform 0.2s ease-out",
	);

	return (
		<motion.div
			ref={stageRef}
			custom={direction}
			variants={slideVariants}
			initial="enter"
			animate="center"
			exit="exit"
			transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 0.61, 0.36, 1] }}
			className="absolute inset-0 touch-none"
			style={{ pointerEvents: isPresent ? "auto" : "none" }}
			aria-hidden={!isPresent}
			inert={!isPresent}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={cancelGesture}
			onLostPointerCapture={cancelGesture}
			onClick={(event) => {
				if (
					dragged.current ||
					imagePressed.current ||
					(event.target instanceof Element &&
						event.target.closest("[data-preview-frame]"))
				) {
					event.stopPropagation();
				}
				dragged.current = false;
			}}
			onDoubleClick={(event) => {
				if (
					imagePressed.current ||
					(event.target instanceof Element &&
						event.target.closest("[data-preview-frame]"))
				)
					onReset();
			}}
		>
			<motion.div
				className="absolute inset-0 flex items-center justify-center"
				style={{ x: returnX, y: returnY }}
			>
				<motion.div style={{ scale: returnScale, opacity: returnOpacity }}>
					{box ? (
						<motion.div
							data-preview-frame
							initial={reducedMotion || direction !== 0 ? false : origin}
							animate={{ x: 0, y: 0, scale: 1 }}
							transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }}
							className="relative shrink-0"
							style={{ width: box.width, height: box.height }}
						>
							<motion.img
								ref={imgRef}
								src={src}
								alt={alt}
								onLoad={handleLoad}
								onError={() => setFailed(true)}
								decoding="async"
								draggable={false}
								className="absolute inset-0 h-full w-full select-none object-contain"
								style={{
									opacity: ready ? 1 : 0,
									transform: imageTransform,
									transition: imageTransition,
									cursor: "grab",
								}}
							/>
							<AnimatePresence>
								{thumbnail && !ready ? (
									<motion.div
										className="pointer-events-none absolute inset-0"
										initial={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: reducedMotion ? 0 : 0.15 }}
									>
										<img
											src={thumbnail}
											alt=""
											aria-hidden
											draggable={false}
											className="h-full w-full select-none object-contain"
										/>
									</motion.div>
								) : null}
							</AnimatePresence>
						</motion.div>
					) : thumbnail ? (
						<img
							src={thumbnail}
							alt=""
							aria-hidden
							draggable={false}
							data-preview-frame
							className="max-h-[90vh] max-w-[90vw] select-none object-contain"
						/>
					) : null}
				</motion.div>
			</motion.div>
			{failed ? (
				<div
					role="alert"
					className="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
				>
					图片加载失败
				</div>
			) : !ready && !thumbnail ? (
				<div
					role="status"
					aria-label="正在加载图片"
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<div className="size-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
				</div>
			) : null}
		</motion.div>
	);
}
