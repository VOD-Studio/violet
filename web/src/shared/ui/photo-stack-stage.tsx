import { cn } from "@shared/lib/utils";
import { GripHorizontal } from "lucide-react";
import { animate } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PhotoStackImage } from "./photo-stack";
import { type PhotoStackCardMotion, PhotoStackCards } from "./photo-stack-cards";
import {
	type DragSample,
	getDragProgress,
	getStackSlot,
	interpolateSlot,
	recentVelocity,
	recordSample,
	type StackDirection,
	setStackSlot,
	shouldFlip,
} from "./photo-stack-motion";
import { usePhotoStackSlots } from "./use-photo-stack-slots";

export interface PhotoStackStageProps {
	images: PhotoStackImage[];
	currentIndex: number;
	aspectClass: string;
	onIndexChange: (index: number) => void;
	onImageOpen?: (index: number) => void;
}

const FLIP_RATIO = 0.14;
const TILT_PER_PX = 0.08;
const TILT_MAX = 25;
const DRAG_LIMIT_RATIO = 0.75;
const INSERT_MS = 200;
/** 有限 PhotoStack 舞台：负责槽位、插入式拖拽与键盘翻页。 */
export function PhotoStackStage({
	images,
	currentIndex,
	aspectClass,
	onIndexChange,
	onImageOpen,
}: PhotoStackStageProps) {
	const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(images.length - 1, 0));
	const state =
		images.length <= 1
			? "only"
			: safeIndex === 0
				? "first"
				: safeIndex === images.length - 1
					? "last"
					: "middle";
	const stackRef = useRef<HTMLDivElement>(null);
	const pointerStartX = useRef<number | null>(null);
	const suppressClickUntil = useRef(0);
	const suppressClickTimer = useRef(0);
	const settling = useRef(false);
	const settleTimer = useRef(0);
	const dragSamples = useRef<DragSample[]>([]);
	const dragDelta = useRef(0);
	const [stackWidth, setStackWidth] = useState(0);
	const [dragging, setDragging] = useState(false);
	const [dragDirection, setDragDirection] = useState<StackDirection | null>(null);
	const [currentOffset, setCurrentOffset] = useState(0);
	const [incomingProgress, setIncomingProgress] = useState(0);
	const layoutPrefix = useId();

	useEffect(() => {
		const stack = stackRef.current;
		if (!stack) return;
		const measure = () => setStackWidth(stack.offsetWidth);
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(stack);
		return () => observer.disconnect();
	}, []);

	const { motionOf, resetTop, resetCards, visibleCards } = usePhotoStackSlots({
		images,
		safeIndex,
		stackWidth,
	});

	useEffect(
		() => () => {
			window.clearTimeout(settleTimer.current);
			window.clearTimeout(suppressClickTimer.current);
		},
		[],
	);

	const insertToSlot = useCallback(
		(direction: -1 | 1, value: PhotoStackCardMotion) => {
			const nextIndex = safeIndex + direction;
			if (settling.current) return;
			if (nextIndex < 0 || nextIndex >= images.length) {
				resetTop();
				resetCards();
				return;
			}
			const width = stackWidth || 280;
			const rearSide: StackDirection = direction === 1 ? "left" : "right";
			const targetSlot = getStackSlot(rearSide, 1, width);
			settling.current = true;
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.scale.stop();
			animate(value.x, targetSlot.x, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
			animate(value.y, targetSlot.y, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
			animate(value.rotate, targetSlot.rotate, {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			});
			animate(value.scale, targetSlot.scale, {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			});
			window.clearTimeout(settleTimer.current);
			settleTimer.current = window.setTimeout(() => {
				onIndexChange(nextIndex);
				setDragDirection(null);
				setCurrentOffset(0);
				setIncomingProgress(0);
				settling.current = false;
			}, INSERT_MS);
		},
		[images.length, onIndexChange, resetCards, resetTop, safeIndex, stackWidth],
	);
	const suppressClick = () => {
		suppressClickUntil.current = Date.now() + 320;
		window.clearTimeout(suppressClickTimer.current);
		suppressClickTimer.current = window.setTimeout(() => {
			suppressClickUntil.current = 0;
		}, 320);
	};

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || settling.current) return;
		pointerStartX.current = event.clientX;
		dragDelta.current = 0;
		dragSamples.current = [{ t: event.timeStamp, x: event.clientX }];
		setDragDirection(null);
		setCurrentOffset(0);
		setIncomingProgress(0);
		setDragging(true);
		try {
			stackRef.current?.setPointerCapture(event.pointerId);
		} catch {
			// 没有捕获能力时仍可在舞台范围内回弹。
		}
		const top = images[safeIndex];
		if (top) {
			const value = motionOf(top, safeIndex);
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.scale.stop();
			value.opacity.stop();
		}
		visibleCards.forEach((card) => {
			const value = motionOf(card.image, card.index);
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.scale.stop();
			value.opacity.stop();
		});
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (pointerStartX.current === null || settling.current) return;
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		const rawDelta = event.clientX - pointerStartX.current;
		dragDelta.current = rawDelta;
		if (Math.abs(rawDelta) > 8) {
			suppressClick();
		}
		const canFlip =
			(rawDelta < 0 && safeIndex < images.length - 1) || (rawDelta > 0 && safeIndex > 0);
		const width = stackWidth || 280;
		const direction: StackDirection = rawDelta < 0 ? "right" : "left";
		const progress = getDragProgress(rawDelta, width * FLIP_RATIO);
		const limitedDelta = Math.max(
			-width * DRAG_LIMIT_RATIO,
			Math.min(width * DRAG_LIMIT_RATIO, rawDelta),
		);
		const delta = canFlip
			? limitedDelta
			: Math.sign(rawDelta) *
				width *
				0.08 *
				(1 - Math.exp(-Math.abs(rawDelta) / (width * 0.08)));
		setCurrentOffset(delta);
		setIncomingProgress(canFlip ? progress : 0);
		setDragDirection(direction);
		setStackSlot(value, {
			x: delta,
			y: 0,
			rotate: Math.max(-TILT_MAX, Math.min(TILT_MAX, delta * TILT_PER_PX)),
			scale: 1,
		});
		recordSample(dragSamples.current, event.timeStamp, event.clientX);
		visibleCards.forEach((card) => {
			const cardValue = motionOf(card.image, card.index);
			const from = getStackSlot(card.axis, card.depth, width);
			const to = getStackSlot(card.axis, Math.max(card.depth - 1, 0), width);
			const slot = card.axis === direction ? interpolateSlot(from, to, progress) : from;
			setStackSlot(cardValue, slot);
		});
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (pointerStartX.current === null) return;
		pointerStartX.current = null;
		setDragging(false);
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		const delta = value.x.get();
		const direction: -1 | 1 = delta < 0 ? 1 : -1;
		const canFlip =
			(direction === 1 && safeIndex < images.length - 1) ||
			(direction === -1 && safeIndex > 0);
		if (
			shouldFlip(
				delta,
				recentVelocity(dragSamples.current),
				(stackWidth || 280) * FLIP_RATIO,
				canFlip,
			)
		) {
			insertToSlot(direction, value);
		} else {
			resetTop();
			resetCards();
			setCurrentOffset(0);
			setIncomingProgress(0);
		}
		if (!settling.current) setDragDirection(null);
		try {
			if (stackRef.current?.hasPointerCapture(event.pointerId))
				stackRef.current.releasePointerCapture(event.pointerId);
		} catch {
			// 捕获已经失效时无需处理。
		}
	};

	const onPointerCancel = () => {
		if (pointerStartX.current === null) return;
		pointerStartX.current = null;
		setDragging(false);
		setDragDirection(null);
		setCurrentOffset(0);
		setIncomingProgress(0);
		suppressClick();
		resetTop();
		resetCards();
	};
	if (images.length === 0) return null;

	return (
		<div
			ref={stackRef}
			role="group"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: 照片堆叠需要焦点来响应方向键
			tabIndex={0}
			aria-label={`第 ${safeIndex + 1} 项，共 ${images.length} 项`}
			data-stack-state={state}
			data-current-index={safeIndex}
			data-drag-direction={dragDirection ?? "none"}
			data-transition="cover"
			className={cn(
				"relative isolate mx-auto w-[72%] touch-pan-y select-none",
				dragging ? "cursor-grabbing" : "cursor-grab",
				aspectClass,
			)}
			data-current-offset={currentOffset}
			data-incoming-progress={incomingProgress}
			onKeyDown={(event) => {
				if (event.key === "ArrowLeft" && safeIndex > 0) {
					event.preventDefault();
					const top = images[safeIndex];
					if (top) insertToSlot(-1, motionOf(top, safeIndex));
				}
				if (event.key === "ArrowRight" && safeIndex < images.length - 1) {
					event.preventDefault();
					const top = images[safeIndex];
					if (top) insertToSlot(1, motionOf(top, safeIndex));
				}
			}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onLostPointerCapture={onPointerCancel}
		>
			<PhotoStackCards
				visibleCards={visibleCards}
				current={images[safeIndex]}
				currentIndex={safeIndex}
				stackWidth={stackWidth}
				layoutPrefix={layoutPrefix}
				motionOf={motionOf}
				onCurrentClick={() => {
					if (Date.now() >= suppressClickUntil.current) onImageOpen?.(safeIndex);
				}}
				dragDirection={dragDirection}
				dragProgress={incomingProgress}
			/>
			<div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
				<span className="rounded-full bg-black/45 p-1.5 backdrop-blur-sm">
					<GripHorizontal className="size-4 text-white/90" />
				</span>
			</div>
			<div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[10px] text-white/90 backdrop-blur-sm">
				{safeIndex + 1} / {images.length}
			</div>
		</div>
	);
}
