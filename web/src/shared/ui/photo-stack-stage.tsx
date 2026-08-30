import { cn } from "@shared/lib/utils";
import { GripHorizontal } from "lucide-react";
import { animate } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PhotoStackImage } from "./photo-stack";
import { type PhotoStackCardMotion, PhotoStackCards } from "./photo-stack-cards";
import {
	type DragSample,
	FLIP_THRESHOLD_RATIO,
	getBoundaryFollowerSlot,
	getDraggedTopSlot,
	getIndexedStackSlot,
	getReleasePeakSlot,
	getStackCardOpacity,
	getStackSlot,
	interpolateSlot,
	type PhotoStackSlot,
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
const RELEASE_PEAK_MS = 56;
const FADE_IN_MS = 260;
const TRANSITION_MS = Math.max(INSERT_MS, FADE_IN_MS);
type DragCardOrigin = PhotoStackSlot & { opacity: number; rotateY: number };
/** PhotoStack 舞台：负责槽位、插入式拖拽与键盘翻页。 */
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
	const thresholdTimer = useRef(0);
	const transitionTimers = useRef(new Map<number, number>());
	const dragSamples = useRef<DragSample[]>([]);
	const dragOrigin = useRef({ x: 0, y: 0, rotate: 0, rotateY: 0, scale: 1 });
	const cardDragOrigins = useRef(new Map<number, DragCardOrigin>());
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

	const isTransitioning = useCallback((index: number) => transitionTimers.current.has(index), []);
	const releaseTransition = useCallback((index: number) => {
		const timer = transitionTimers.current.get(index);
		if (timer !== undefined) window.clearTimeout(timer);
		transitionTimers.current.delete(index);
	}, []);
	const markTransitioning = useCallback(
		(index: number) => {
			releaseTransition(index);
			const timer = window.setTimeout(() => {
				transitionTimers.current.delete(index);
			}, TRANSITION_MS);
			transitionTimers.current.set(index, timer);
		},
		[releaseTransition],
	);
	const { motionOf, resetTop, resetCards, resetBoundary, visibleCards } = usePhotoStackSlots({
		images,
		safeIndex,
		stackWidth,
		isTransitioning,
	});

	useEffect(
		() => () => {
			window.clearTimeout(thresholdTimer.current);
			window.clearTimeout(suppressClickTimer.current);
			transitionTimers.current.forEach((timer) => {
				window.clearTimeout(timer);
			});
			transitionTimers.current.clear();
		},
		[],
	);

	const insertToSlot = useCallback(
		(
			direction: -1 | 1,
			value: PhotoStackCardMotion,
			releaseVelocity = 0,
			completePullPhase = false,
			releaseDelta = value.x.get(),
		) => {
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
			const peak = getReleasePeakSlot(releaseDelta, releaseVelocity, width);
			const releaseProgress = Math.min(
				1,
				Math.abs(releaseDelta) / Math.max(1, width * PULL_THRESHOLD_RATIO),
			);
			const fadeDurationMs = Math.max(1, FADE_IN_MS * (1 - releaseProgress));
			const releaseTransition = {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
				times: [0, RELEASE_PEAK_MS / INSERT_MS, 1],
			};
			const settleTransition = {
				duration: INSERT_MS / 1000,
				ease: "easeOut" as const,
			};
			const opacityTransition = {
				duration: fadeDurationMs / 1000,
				ease: "linear" as const,
			};
			images.forEach((_, index) => {
				markTransitioning(index);
			});
			settling.current = true;
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.rotateY.stop();
			value.scale.stop();
			value.opacity.stop();
			animate(
				value.x,
				completePullPhase ? [null, peak.topSlot.x, targetSlot.x] : targetSlot.x,
				completePullPhase ? releaseTransition : settleTransition,
			);
			animate(
				value.y,
				completePullPhase ? [null, peak.topSlot.y, targetSlot.y] : targetSlot.y,
				completePullPhase ? releaseTransition : settleTransition,
			);
			animate(
				value.rotate,
				completePullPhase
					? [null, peak.topSlot.rotate, targetSlot.rotate]
					: targetSlot.rotate,
				completePullPhase ? releaseTransition : settleTransition,
			);
			animate(
				value.rotateY,
				completePullPhase ? [null, peak.rotateY, 0] : 0,
				completePullPhase ? releaseTransition : settleTransition,
			);
			animate(
				value.scale,
				completePullPhase ? [null, peak.topSlot.scale, targetSlot.scale] : targetSlot.scale,
				completePullPhase ? releaseTransition : settleTransition,
			);
			animate(value.opacity, 1, opacityTransition);
			window.clearTimeout(thresholdTimer.current);
			const commitIndex = () => {
				onIndexChange(nextIndex);
				setDragDirection(null);
				setCurrentOffset(0);
				setIncomingProgress(0);
				setIsPastThreshold(false);
				settling.current = false;
			};
			if (completePullPhase) {
				thresholdTimer.current = window.setTimeout(() => {
					commitIndex();
				}, RELEASE_PEAK_MS);
			} else {
				commitIndex();
			}
			// 新顶卡的几何动画在 220ms 内到达中心。
			const nextTop = images[nextIndex];
			if (nextTop) {
				const nextTopMotion = motionOf(nextTop, nextIndex);
				nextTopMotion.x.stop();
				nextTopMotion.y.stop();
				nextTopMotion.rotate.stop();
				nextTopMotion.rotateY.stop();
				nextTopMotion.scale.stop();
				nextTopMotion.opacity.stop();
				animate(nextTopMotion.x, 0, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.y, 0, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.rotate, 0, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.rotateY, 0, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.scale, 1, {
					duration: INSERT_MS / 1000,
					ease: "easeOut" as const,
				});
				animate(nextTopMotion.opacity, 1, opacityTransition);
			}

			// 后置卡片的几何动画在 220ms 内落位；进入可见集合的卡片单独淡入。
			const maxDepth = images.length - 1;
			for (let depth = maxDepth; depth >= 1; depth -= 1) {
				const prevIdx = nextIndex - depth;
				if (prevIdx >= 0 && prevIdx !== safeIndex) {
					const cardMotion = motionOf(images[prevIdx], prevIdx);
					const slot = getStackSlot("left", depth, width);
					cardMotion.x.stop();
					cardMotion.y.stop();
					cardMotion.rotate.stop();
					cardMotion.rotateY.stop();
					cardMotion.scale.stop();
					cardMotion.opacity.stop();
					animate(cardMotion.x, slot.x, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.y, slot.y, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.rotate, slot.rotate, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.rotateY, 0, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.scale, slot.scale, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(
						cardMotion.opacity,
						getStackCardOpacity(prevIdx, nextIndex, images.length),
						opacityTransition,
					);
				}
				const nextIdx = nextIndex + depth;
				if (nextIdx < images.length) {
					const cardMotion = motionOf(images[nextIdx], nextIdx);
					const slot = getStackSlot("right", depth, width);
					cardMotion.x.stop();
					cardMotion.y.stop();
					cardMotion.rotate.stop();
					cardMotion.rotateY.stop();
					cardMotion.scale.stop();
					cardMotion.opacity.stop();
					animate(cardMotion.x, slot.x, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.y, slot.y, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.rotate, slot.rotate, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.rotateY, 0, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(cardMotion.scale, slot.scale, {
						duration: INSERT_MS / 1000,
						ease: "easeOut" as const,
					});
					animate(
						cardMotion.opacity,
						getStackCardOpacity(nextIdx, nextIndex, images.length),
						opacityTransition,
					);
				}
			}
		},
		[
			images,
			markTransitioning,
			motionOf,
			onIndexChange,
			resetCards,
			resetTop,
			safeIndex,
			stackWidth,
		],
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
		dragSamples.current = [{ t: event.timeStamp, x: event.clientX }];
		cardDragOrigins.current.clear();
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
			releaseTransition(safeIndex);
			const value = motionOf(top, safeIndex);
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.rotateY.stop();
			value.scale.stop();
			value.opacity.stop();
			dragOrigin.current = {
				x: value.x.get(),
				y: value.y.get(),
				rotate: value.rotate.get(),
				rotateY: value.rotateY.get(),
				scale: value.scale.get(),
			};
		}
	};
	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (pointerStartX.current === null || settling.current) return;
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		const rawDelta = event.clientX - pointerStartX.current;
		if (Math.abs(rawDelta) > 8) {
			suppressClick();
		}
		const canFlip =
			(rawDelta < 0 && safeIndex < images.length - 1) || (rawDelta > 0 && safeIndex > 0);
		const width = stackWidth || 280;
		const direction: StackDirection = rawDelta < 0 ? "right" : "left";
		const result = getDraggedTopSlot(rawDelta, width, canFlip);
		const { topSlot, rotateY, isPastThreshold: past, pullProgress } = result;
		const origin = dragOrigin.current;
		const continuedTopSlot = {
			...topSlot,
			x: origin.x + topSlot.x,
			y: origin.y + topSlot.y,
			rotate: origin.rotate + topSlot.rotate,
			scale: origin.scale + topSlot.scale - 1,
		};
		setCurrentOffset(continuedTopSlot.x);
		setIncomingProgress(canFlip ? pullProgress : 0);
		setIsPastThreshold(canFlip && past);
		setDragDirection(direction);
		setStackSlot(value, continuedTopSlot);
		value.rotateY.set(origin.rotateY + rotateY);
		recordSample(dragSamples.current, event.timeStamp, event.clientX);
		visibleCards.forEach((card) => {
			const cardValue = motionOf(card.image, card.index);
			let cardOrigin = cardDragOrigins.current.get(card.index);
			if (!cardOrigin) {
				releaseTransition(card.index);
				cardValue.x.stop();
				cardValue.y.stop();
				cardValue.rotate.stop();
				cardValue.rotateY.stop();
				cardValue.scale.stop();
				cardValue.opacity.stop();
				cardOrigin = {
					x: cardValue.x.get(),
					y: cardValue.y.get(),
					rotate: cardValue.rotate.get(),
					rotateY: cardValue.rotateY.get(),
					scale: cardValue.scale.get(),
					opacity: cardValue.opacity.get(),
				};
				cardDragOrigins.current.set(card.index, cardOrigin);
			}
			const nextIndex = safeIndex + (rawDelta < 0 ? 1 : -1);
			const targetSlot = getIndexedStackSlot(card.index, nextIndex, width);
			const slot = canFlip
				? interpolateSlot(cardOrigin, targetSlot, pullProgress)
				: getBoundaryFollowerSlot(cardOrigin, topSlot.x, card.depth);
			const targetOpacity = canFlip
				? getStackCardOpacity(card.index, nextIndex, images.length)
				: cardOrigin.opacity;
			const opacity =
				cardOrigin.opacity + (targetOpacity - cardOrigin.opacity) * pullProgress;
			setStackSlot(cardValue, slot, opacity);
			cardValue.rotateY.set(
				canFlip ? cardOrigin.rotateY * (1 - pullProgress) : cardOrigin.rotateY,
			);
		});
	};

	const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (pointerStartX.current === null) return;
		const rawDelta = event.clientX - pointerStartX.current;
		pointerStartX.current = null;
		setDragging(false);
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		const lastSample = dragSamples.current.at(-1);
		if (!lastSample || lastSample.x !== event.clientX) {
			recordSample(dragSamples.current, event.timeStamp, event.clientX);
		}
		const direction: -1 | 1 = rawDelta < 0 ? 1 : -1;
		const canFlip =
			(direction === 1 && safeIndex < images.length - 1) ||
			(direction === -1 && safeIndex > 0);
		const flipThreshold = (stackWidth || 280) * FLIP_THRESHOLD_RATIO;
		if (
			canFlip &&
			shouldFlip(
				rawDelta,
				recentVelocity(dragSamples.current, 100, event.timeStamp),
				flipThreshold,
				canFlip,
			)
		) {
			const releaseVelocity = recentVelocity(dragSamples.current, 100, event.timeStamp);
			const completePullPhase =
				Math.abs(rawDelta) < (stackWidth || 280) * PULL_THRESHOLD_RATIO;
			if (!completePullPhase) setIsPastThreshold(true);
			insertToSlot(direction, value, releaseVelocity, completePullPhase, rawDelta);
		} else {
			if (canFlip) {
				resetTop();
				resetCards();
			} else {
				resetBoundary();
			}
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
		cardDragOrigins.current.clear();
	};

	const onPointerCancel = () => {
		if (pointerStartX.current === null) return;
		pointerStartX.current = null;
		setDragging(false);
		setDragDirection(null);
		setCurrentOffset(0);
		setIncomingProgress(0);
		setIsPastThreshold(false);
		cardDragOrigins.current.clear();
		suppressClick();
		resetTop();
		resetCards();
	};
	if (images.length === 0) return null;

	return (
		<div
			ref={stackRef}
			role="group"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: 方向键翻页需要让舞台自身可被键盘聚焦。
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
