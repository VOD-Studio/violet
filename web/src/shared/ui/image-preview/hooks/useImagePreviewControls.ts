import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface UseImagePreviewControlsProps {
	open: boolean;
	images: string[];
	currentIndex: number;
	onIndexChange?: (index: number) => void;
	onClose: () => void;
}

/**
 * 管理循环导航、图像变换与预览期间的键盘和滚动锁。
 *
 * @returns 当前图像状态与统一的导航、变换操作。
 */
export function useImagePreviewControls({
	open,
	images,
	currentIndex,
	onIndexChange,
	onClose,
}: UseImagePreviewControlsProps) {
	const [index, setIndex] = useState(currentIndex);
	const indexRef = useRef(currentIndex);
	const [direction, setDirection] = useState(0);
	const [scale, setScale] = useState(1);
	const [rotate, setRotate] = useState(0);
	const [flipX, setFlipX] = useState(false);
	const [flipY, setFlipY] = useState(false);
	// 重置缩放/旋转/翻转为初始状态（图片位置在 ImagePreviewImage 内自行重置）
	const handleReset = useCallback(() => {
		setScale(1);
		setRotate(0);
		setFlipX(false);
		setFlipY(false);
	}, []);

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
		setScale((prev) => Math.min(prev + 0.5, 3));
	}, []);

	const handleZoomOut = useCallback(() => {
		setScale((prev) => Math.max(prev - 0.5, 0.5));
	}, []);

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

	const handleWheel = useCallback((delta: number) => {
		setScale((prev) => {
			const newScale = prev - delta * 0.001;
			return Math.max(0.5, Math.min(3, newScale));
		});
	}, []);

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

	useEffect(() => {
		if (open) {
			if (typeof document === "undefined") return;
			const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
			const originalOverflow = document.body.style.overflow;
			const originalPaddingRight = document.body.style.paddingRight;
			document.body.style.overflow = "hidden";
			if (scrollbarWidth > 0) {
				document.body.style.paddingRight = `${scrollbarWidth}px`;
			}
			return () => {
				document.body.style.overflow = originalOverflow;
				document.body.style.paddingRight = originalPaddingRight;
			};
		}
	}, [open]);

	return {
		index,
		scale,
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
