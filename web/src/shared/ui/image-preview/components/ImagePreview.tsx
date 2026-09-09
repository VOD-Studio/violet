import { originalImageUrl } from "@shared/lib/image-url";
import {
	AnimatePresence,
	animate,
	motion,
	usePresence,
	useReducedMotion,
	useTransform,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useImagePreviewControls } from "../hooks/useImagePreviewControls";
import type { ImagePreviewProps } from "../types/image-preview-types";
import { ImagePreviewControls } from "./ImagePreviewControls";
import { ImagePreviewImage } from "./ImagePreviewImage";
import { ImagePreviewThumbnails } from "./ImagePreviewThumbnails";

function imageAspectRatio(image: HTMLImageElement | undefined): number | undefined {
	if (!image) return undefined;
	const width = image.naturalWidth || Number.parseFloat(image.getAttribute("width") ?? "");
	const height = image.naturalHeight || Number.parseFloat(image.getAttribute("height") ?? "");
	return width > 0 && height > 0 ? width / height : undefined;
}

/** 全屏图片查看器，每次打开独立初始化索引、入场方向与图像变换。 */
export function ImagePreview(props: ImagePreviewProps) {
	const [mounted, setMounted] = useState(false);
	const [session, setSession] = useState({ open: props.open, key: 0, visible: props.open });
	useEffect(() => {
		setMounted(true);
	}, []);

	// 在提交前建立新会话，避免旧索引先挂载并被 AnimatePresence 留作退场图。
	if (session.open !== props.open) {
		setSession({
			open: props.open,
			key: session.key + (props.open ? 1 : 0),
			visible: session.visible || props.open,
		});
	}

	useEffect(() => {
		if (!session.visible) return;
		const body = document.body;
		const originalOverflow = body.style.overflow;
		const originalPaddingRight = body.style.paddingRight;
		const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
		body.style.overflow = "hidden";
		if (scrollbarWidth > 0) {
			body.style.paddingRight = `${Number.parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
		}
		return () => {
			body.style.overflow = originalOverflow;
			body.style.paddingRight = originalPaddingRight;
		};
	}, [session.visible]);

	if (typeof document === "undefined" || !mounted) return null;
	return createPortal(
		<AnimatePresence
			onExitComplete={() => {
				if (!props.open) {
					setSession((current) => ({ ...current, visible: false }));
					props.onExitComplete?.();
				}
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
	const [isPresent, safeToRemove] = usePresence();
	const reducedMotion = useReducedMotion();
	const {
		index,
		scale,
		closeProgress,
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

	const chromeOpacity = useTransform(closeProgress, [0, 1], [1, 0]);
	useEffect(() => {
		if (isPresent) return;
		if (closeProgress.get() === 1) {
			safeToRemove?.();
			return;
		}
		const animation = animate(closeProgress, 1, {
			duration: reducedMotion ? 0 : 0.3 * (1 - closeProgress.get()),
			ease: [0.22, 0.61, 0.36, 1],
			onComplete: safeToRemove,
		});
		return () => animation.stop();
	}, [isPresent, closeProgress, reducedMotion, safeToRemove]);

	const [resetKey, setResetKey] = useState(0);
	const [listVisible, setListVisible] = useState(false);
	const handleResetAll = useCallback(() => {
		handleReset();
		setResetKey((prev) => prev + 1);
	}, [handleReset]);

	const [opening] = useState(() => {
		const initialImage =
			triggerElement instanceof HTMLImageElement
				? triggerElement
				: triggerElement?.querySelector("img");
		const scope = triggerElement?.closest("article") ?? document;
		const candidates = Array.from(scope.querySelectorAll("img"))
			.filter((image) => !image.closest('[aria-label="图片预览"]'))
			.map((image) => ({ image, src: originalImageUrl(image.currentSrc || image.src) }));
		const used = new Set<HTMLImageElement>(initialImage ? [initialImage] : []);
		const sources = images.map((src, imageIndex) => {
			if (imageIndex === currentIndex && initialImage) return initialImage;
			const url = originalImageUrl(
				URL.canParse(src, document.baseURI) ? new URL(src, document.baseURI).href : src,
			);
			const match = candidates.find(
				(candidate) => candidate.src === url && !used.has(candidate.image),
			);
			if (match) used.add(match.image);
			return match?.image;
		});
		return {
			index: currentIndex,
			rect:
				triggerRect ??
				initialImage?.getBoundingClientRect() ??
				triggerElement?.getBoundingClientRect() ??
				null,
			size: initialNaturalSize,
			sources,
			aspectRatios: sources.map(imageAspectRatio),
			restore:
				triggerElement ??
				(document.activeElement instanceof HTMLElement ? document.activeElement : null),
		};
	});
	const [returnRect, setReturnRect] = useState(opening.rect);
	const returnFocus = useRef(opening.restore);
	useLayoutEffect(() => {
		const source = opening.sources[index];
		if (!source?.isConnected) {
			setReturnRect(index === opening.index ? opening.rect : null);
			return;
		}
		let rect = source.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			setReturnRect(index === opening.index ? opening.rect : null);
			return;
		}
		if (
			rect.bottom <= 0 ||
			rect.top >= window.innerHeight ||
			rect.right <= 0 ||
			rect.left >= window.innerWidth
		) {
			source.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
			rect = source.getBoundingClientRect();
		}
		setReturnRect(rect);
		returnFocus.current = source.closest("button") ?? source;
	}, [index, opening]);

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
			returnFocus.current?.focus({ preventScroll: true });
		};
	}, [isPresent]);

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
			transition={{ duration: 0.25 }}
			className="fixed inset-0 z-9999 overflow-hidden outline-none"
			// Radix modal 会禁用 body 指针事件；只有当前会话恢复交互。
			style={{ pointerEvents: isPresent ? "auto" : "none" }}
			onClick={onClose}
		>
			<motion.div
				className="absolute inset-0 bg-black/70"
				style={{ opacity: chromeOpacity }}
			/>
			<motion.div
				className="pointer-events-none absolute inset-0 z-50 [&>*]:pointer-events-auto"
				style={{ opacity: chromeOpacity }}
			>
				<ImagePreviewControls
					scale={scale}
					currentIndex={index}
					totalImages={images.length}
					listVisible={listVisible}
					onClose={onClose}
					onZoomIn={handleZoomIn}
					onZoomOut={handleZoomOut}
					onPrevious={handlePrevious}
					onNext={handleNext}
					onRotateLeft={handleRotateLeft}
					onRotateRight={handleRotateRight}
					onFlipX={handleFlipX}
					onFlipY={handleFlipY}
					onToggleList={() => setListVisible((visible) => !visible)}
					onReset={handleResetAll}
				/>
			</motion.div>

			<AnimatePresence custom={direction}>
				{images[index] ? (
					<ImagePreviewImage
						key={`${index}:${images[index]}`}
						src={images[index]}
						thumbnail={thumbnails?.[index]}
						alt={alts?.[index] ?? `预览图片 ${index + 1}`}
						direction={direction}
						triggerRect={returnRect}
						placeholderAspectRatio={opening.aspectRatios[index]}
						closeProgress={closeProgress}
						initialNaturalSize={opening.index === index ? opening.size : undefined}
						scale={scale}
						rotate={rotate}
						flipX={flipX}
						flipY={flipY}
						onLoad={() => setLoadedSource(images[index])}
						onReset={handleResetAll}
						onWheelFollow={handleWheel}
						onSwipeLeft={images.length > 1 ? handleNext : undefined}
						onSwipeRight={images.length > 1 ? handlePrevious : undefined}
						resetKey={resetKey}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence>
				{listVisible ? (
					<motion.div
						className="pointer-events-none absolute inset-0 z-50 [&>*]:pointer-events-auto"
						style={{ opacity: chromeOpacity }}
					>
						<ImagePreviewThumbnails
							images={thumbnails ?? images}
							currentIndex={index}
							onSelect={handleSelect}
						/>
					</motion.div>
				) : null}
			</AnimatePresence>
		</motion.div>
	);
}
