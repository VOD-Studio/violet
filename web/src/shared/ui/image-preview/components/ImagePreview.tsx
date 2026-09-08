import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useImagePreviewControls } from "../hooks/useImagePreviewControls";
import type { ImagePreviewProps } from "../types/image-preview-types";
import { ImagePreviewControls } from "./ImagePreviewControls";
import { ImagePreviewImage } from "./ImagePreviewImage";
import { ImagePreviewThumbnails } from "./ImagePreviewThumbnails";

/** 全屏图片查看器，每次打开独立初始化索引、入场方向与图像变换。 */
export function ImagePreview(props: ImagePreviewProps) {
	const [mounted, setMounted] = useState(false);
	const [session, setSession] = useState({ open: props.open, key: 0 });
	useEffect(() => {
		setMounted(true);
	}, []);

	// 在提交前建立新会话，避免旧索引先挂载并被 AnimatePresence 留作退场图。
	if (session.open !== props.open) {
		setSession({ open: props.open, key: session.key + (props.open ? 1 : 0) });
	}

	if (typeof document === "undefined" || !mounted) return null;
	return createPortal(
		<AnimatePresence
			onExitComplete={() => {
				if (!props.open) props.onExitComplete?.();
			}}
		>
			{props.open ? <ImagePreviewDialog key={session.key} {...props} /> : null}
		</AnimatePresence>,
		document.body,
	);
}

function ImagePreviewDialog({
	onClose,
	images,
	alts,
	thumbnails,
	currentIndex = 0,
	onIndexChange,
	triggerElement,
	triggerRect,
	initialNaturalSize,
}: ImagePreviewProps) {
	const isPresent = useIsPresent();
	const {
		index,
		scale,
		rotate,
		flipX,
		flipY,
		handlePrevious,
		direction,
		handleSelect,
		handleNext,
		handleZoomIn,
		handleZoomOut,
		handleWheel,
		handleRotateLeft,
		handleRotateRight,
		handleFlipX,
		handleFlipY,
		handleReset,
	} = useImagePreviewControls({
		open: isPresent,
		images,
		currentIndex,
		onIndexChange,
		onClose,
	});

	const [resetKey, setResetKey] = useState(0);
	const handleResetAll = useCallback(() => {
		handleReset();
		setResetKey((prev) => prev + 1);
	}, [handleReset]);

	const [opening] = useState(() => ({
		index: currentIndex,
		rect: triggerRect ?? triggerElement?.getBoundingClientRect() ?? null,
		size: initialNaturalSize,
		restore:
			triggerElement ??
			(document.activeElement instanceof HTMLElement ? document.activeElement : null),
	}));

	const [loadedSource, setLoadedSource] = useState<string | null>(null);
	useEffect(() => {
		if (!isPresent || loadedSource !== images[index] || images.length < 2) return;
		const neighbors = new Set([
			images[(index + images.length - 1) % images.length],
			images[(index + 1) % images.length],
		]);
		for (const src of neighbors) {
			if (src === loadedSource) continue;
			const image = new Image();
			image.decoding = "async";
			image.fetchPriority = "low";
			image.src = src;
		}
	}, [isPresent, index, images, loadedSource]);

	const overlayRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!isPresent) return;
		overlayRef.current?.focus();
		return () => {
			opening.restore?.focus();
		};
	}, [isPresent, opening.restore]);

	useEffect(() => {
		if (!isPresent) return;
		const handleTab = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const overlay = overlayRef.current;
			if (!overlay) return;
			const focusables = Array.from(
				overlay.querySelectorAll<HTMLElement>(
					"button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
				),
			);
			if (focusables.length === 0) {
				event.preventDefault();
				overlay.focus();
				return;
			}
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;
			const outside = active === overlay || !overlay.contains(active);
			if (event.shiftKey && (active === first || outside)) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (active === last || outside)) {
				event.preventDefault();
				first.focus();
			}
		};
		window.addEventListener("keydown", handleTab);
		return () => window.removeEventListener("keydown", handleTab);
	}, [isPresent]);

	return (
		<motion.div
			ref={overlayRef}
			role="dialog"
			aria-modal="true"
			aria-label="图片预览"
			aria-hidden={!isPresent}
			inert={!isPresent}
			tabIndex={-1}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.25 }}
			className="fixed inset-0 z-9999 overflow-hidden bg-black/70 outline-none"
			// Radix modal 会禁用 body 指针事件；只有当前会话恢复交互。
			style={{ pointerEvents: isPresent ? "auto" : "none" }}
			onClick={onClose}
		>
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

			<AnimatePresence custom={direction}>
				{images[index] ? (
					<ImagePreviewImage
						key={`${index}:${images[index]}`}
						src={images[index]}
						thumbnail={thumbnails?.[index]}
						alt={alts?.[index] ?? `预览图片 ${index + 1}`}
						direction={direction}
						triggerRect={direction === 0 ? opening.rect : null}
						initialNaturalSize={opening.index === index ? opening.size : undefined}
						scale={scale}
						rotate={rotate}
						flipX={flipX}
						flipY={flipY}
						onLoad={() => setLoadedSource(images[index])}
						onReset={handleResetAll}
						onWheelZoom={handleWheel}
						onSwipeLeft={images.length > 1 ? handleNext : undefined}
						onSwipeRight={images.length > 1 ? handlePrevious : undefined}
						resetKey={resetKey}
					/>
				) : null}
			</AnimatePresence>

			<ImagePreviewThumbnails
				images={thumbnails ?? images}
				currentIndex={index}
				onSelect={handleSelect}
			/>
		</motion.div>
	);
}
