import { cn } from "@shared/lib/utils";
import { GripHorizontal } from "lucide-react";
import { animate } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PhotoStackImage } from "./photo-stack";
import { type PhotoStackCardMotion, PhotoStackCards } from "./photo-stack-cards";
import {
	type DragSample,
	getDraggedTopSlot,
	getStackSlot,
	interpolateSlot,
	PULL_THRESHOLD_RATIO,
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
const INSERT_MS = 220;
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
	const [isPastThreshold, setIsPastThreshold] = useState(false);
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
			value.rotateY.stop();
			value.scale.stop();
			animate(value.x, targetSlot.x, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
			animate(value.y, targetSlot.y, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
			animate(value.rotate, targetSlot.rotate, {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			});
			animate(value.rotateY, 0, {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			});
			animate(value.scale, targetSlot.scale, {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			});
			// 2. 新顶卡在同一个 220ms 内同步动画到达中心
			const nextTop = images[nextIndex];
			if (nextTop) {
				const nextTopMotion = motionOf(nextTop, nextIndex);
				nextTopMotion.x.stop();
				nextTopMotion.y.stop();
				nextTopMotion.rotate.stop();
				nextTopMotion.rotateY.stop();
				nextTopMotion.scale.stop();
				nextTopMotion.rotateY.set(0);
				animate(nextTopMotion.x, 0, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
				animate(nextTopMotion.y, 0, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
				animate(nextTopMotion.rotate, 0, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.scale, 1, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
			}

			// 3. 所有在新索引下需要就位的后置卡片（包括最后一张图）全部在同一个 220ms 内同步平滑动画落位，绝无后延
			for (let depth = 3; depth >= 1; depth -= 1) {
				const prevIdx = nextIndex - depth;
				if (prevIdx >= 0 && prevIdx !== safeIndex) {
					const cardMotion = motionOf(images[prevIdx], prevIdx);
					const slot = getStackSlot("left", depth, width);
					cardMotion.x.stop();
					cardMotion.y.stop();
					cardMotion.rotateY.stop();
					cardMotion.rotateY.set(0);
					cardMotion.scale.stop();
					animate(cardMotion.x, slot.x, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
					animate(cardMotion.y, slot.y, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
					animate(cardMotion.rotate, slot.rotate, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.scale, slot.scale, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
				}
				const nextIdx = nextIndex + depth;
				if (nextIdx < images.length) {
					const cardMotion = motionOf(images[nextIdx], nextIdx);
					const slot = getStackSlot("right", depth, width);
					cardMotion.x.stop();
					cardMotion.y.stop();
					cardMotion.rotateY.stop();
					cardMotion.rotateY.set(0);
					cardMotion.scale.stop();
					animate(cardMotion.x, slot.x, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
					animate(cardMotion.y, slot.y, { duration: INSERT_MS / 1000, ease: "easeOut" as const });
					animate(cardMotion.rotate, slot.rotate, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.scale, slot.scale, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
				}
			}

			window.clearTimeout(settleTimer.current);
			settleTimer.current = window.setTimeout(() => {
				onIndexChange(nextIndex);
				setDragDirection(null);
				setCurrentOffset(0);
				setIncomingProgress(0);
				setIsPastThreshold(false);
				settling.current = false;
			}, INSERT_MS);
		},
		[images, motionOf, onIndexChange, resetCards, resetTop, safeIndex, stackWidth],
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
		setCurrentOffset(0);
		setIncomingProgress(0);
		setIsPastThreshold(false);
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
			value.rotateY.stop();
			value.scale.stop();
			value.opacity.stop();
		}
		visibleCards.forEach((card) => {
			const value = motionOf(card.image, card.index);
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.rotateY.stop();
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
		const result = getDraggedTopSlot(rawDelta, width, canFlip);
		const { topSlot, isPastThreshold: past, pullProgress } = result;
		setCurrentOffset(topSlot.x);
		setIncomingProgress(canFlip ? pullProgress : 0);
		setIsPastThreshold(canFlip && past);
		setDragDirection(direction);
		setStackSlot(value, topSlot);
		value.rotateY.set(result.rotateY);
		recordSample(dragSamples.current, event.timeStamp, event.clientX);
		visibleCards.forEach((card) => {
			const cardValue = motionOf(card.image, card.index);
			const from = getStackSlot(card.axis, card.depth, width);
			const to = getStackSlot(card.axis, Math.max(card.depth - 1, 0), width);
			const slot = card.axis === direction ? interpolateSlot(from, to, pullProgress) : from;
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
		const flipThreshold = (stackWidth || 280) * PULL_THRESHOLD_RATIO;
		if (
			isPastThreshold ||
			shouldFlip(delta, recentVelocity(dragSamples.current), flipThreshold, canFlip)
		) {
			insertToSlot(direction, value);
		} else {
			resetTop();
			resetCards();
			setCurrentOffset(0);
			setIncomingProgress(0);
			setIsPastThreshold(false);
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
		setIsPastThreshold(false);
		suppressClick();
		resetTop();
		resetCards();
	};
	if (images.length === 0) return null;

	return (
		<div
			ref={stackRef}
			role="group"
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
				isPastThreshold={isPastThreshold}
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
