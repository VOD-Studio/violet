import { useMotionValue } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ImagePreviewProps } from "../types/image-preview-types";

interface UseImagePreviewControlsProps {
	open: boolean;
	images: string[];
	currentIndex: number;
	onIndexChange?: (index: number) => void;
	onClose: () => void;
	wheelAction: NonNullable<ImagePreviewProps["wheelAction"]>;
}

const WHEEL_ZOOM_SENSITIVITY = 0.002;
/**
 * 管理循环导航、图像变换与预览期间的键盘操作。
 *
 * @returns 当前图像状态与统一的导航、变换操作。
 */
export function useImagePreviewControls({
	open,
	images,
	currentIndex,
	onIndexChange,
	onClose,
	wheelAction,
}: UseImagePreviewControlsProps) {
	const [index, setIndex] = useState(currentIndex);
	const indexRef = useRef(currentIndex);
	const [direction, setDirection] = useState(0);
	const [scale, setScale] = useState(1);
	const scaleRef = useRef(1);
	const closeProgress = useMotionValue(0);
	const wheelClosed = useRef(false);
	const updateScale = useCallback((next: number) => {
		scaleRef.current = next;
		setScale(next);
	}, []);
	const [rotate, setRotate] = useState(0);
	const [flipX, setFlipX] = useState(false);
	const [flipY, setFlipY] = useState(false);
	// 重置缩放/旋转/翻转为初始状态（图片位置在 ImagePreviewImage 内自行重置）
	const handleReset = useCallback(() => {
		closeProgress.set(0);
		wheelClosed.current = false;
		updateScale(1);
		setRotate(0);
		setFlipX(false);
		setFlipY(false);
	}, [closeProgress, updateScale]);

	const wasOpen = useRef(false);
	useLayoutEffect(() => {
		const opening = open && !wasOpen.current;
		wasOpen.current = open;
		if (!opening && currentIndex === indexRef.current) return;
		setDirection(opening ? 0 : Math.sign(currentIndex - indexRef.current));
		indexRef.current = currentIndex;
		setIndex(currentIndex);
		handleReset();
	}, [open, currentIndex, handleReset]);

	const handleSelect = useCallback(
		(nextIndex: number, nextDirection = Math.sign(nextIndex - indexRef.current)) => {
			if (nextIndex === indexRef.current) return;
			indexRef.current = nextIndex;
			setDirection(nextDirection);
			setIndex(nextIndex);
			handleReset();
			onIndexChange?.(nextIndex);
		},
		[onIndexChange, handleReset],
	);

	const handlePrevious = useCallback(() => {
		if (images.length <= 1) return;
		handleSelect((indexRef.current + images.length - 1) % images.length, -1);
	}, [images.length, handleSelect]);

	const handleNext = useCallback(() => {
		if (images.length <= 1) return;
		handleSelect((indexRef.current + 1) % images.length, 1);
	}, [images.length, handleSelect]);

	const handleZoomIn = useCallback(() => {
		closeProgress.set(0);
		updateScale(Math.min(scaleRef.current + 0.5, 3));
	}, [closeProgress, updateScale]);

	const handleZoomOut = useCallback(() => {
		closeProgress.set(0);
		updateScale(Math.max(scaleRef.current - 0.5, 0.5));
	}, [closeProgress, updateScale]);

	const handleRotateLeft = useCallback(() => {
		setRotate((prev) => prev - 90);
	}, []);

	const handleRotateRight = useCallback(() => {
		setRotate((prev) => prev + 90);
	}, []);

	const handleFlipX = useCallback(() => {
		setFlipX((prev) => !prev);
	}, []);

	const handleFlipY = useCallback(() => {
		setFlipY((prev) => !prev);
	}, []);

	const handleWheel = useCallback(
		(delta: number) => {
			if (!open || delta === 0) return;
			if (wheelAction === "zoom") {
				updateScale(
					Math.max(
						0.5,
						Math.min(3, scaleRef.current * Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY)),
					),
				);
			} else if (!wheelClosed.current) {
				wheelClosed.current = true;
				onClose();
			}
		},
		[open, wheelAction, updateScale, onClose],
	);

	useEffect(() => {
		if (!open) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case "Escape":
					onClose();
					e.preventDefault();
					break;
				case "ArrowLeft":
					e.preventDefault();
					handlePrevious();
					break;
				case "ArrowRight":
					e.preventDefault();
					handleNext();
					break;
				case "+":
				case "=":
					handleZoomIn();
					break;
				case "-":
					handleZoomOut();
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [open, onClose, handlePrevious, handleNext, handleZoomIn, handleZoomOut]);

	return {
		index,
		scale,
		closeProgress,
		rotate,
		flipX,
		flipY,
		direction,
		handleSelect,
		handlePrevious,
		handleNext,
		handleZoomIn,
		handleZoomOut,
		handleWheel,
		handleRotateLeft,
		handleRotateRight,
		handleFlipX,
		handleFlipY,
		handleReset,
	};
}
