import { animate, motionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PhotoStackImage } from "./photo-stack";
import type { PhotoStackCardMotion, PhotoStackVisibleCard } from "./photo-stack-cards";
import {
	cardMotionKey,
	getStackCardOpacity,
	getStackSlot,
	type PhotoStackSlot,
	resetMotionValueVelocity,
} from "./photo-stack-motion";

const SLOT_SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;
const BOUNDARY_SPRING = { type: "spring", stiffness: 320, damping: 36 } as const;
const RESET_TWEEN = { duration: 0.22, ease: "easeOut" as const };

export interface UsePhotoStackSlotsOptions {
	/** 媒体资源列表。 */
	images: PhotoStackImage[];
	/** 已钳制到列表范围内的当前索引。 */
	safeIndex: number;
	/** 舞台像素宽度。 */
	stackWidth: number;
	/** 判断某张卡是否仍在独立完成上一段换位动画。 */
	isTransitioning?: (index: number) => boolean;
}

/** 管理照片堆叠的卡片 MotionValue、可见槽位和回弹动作。 */
export function usePhotoStackSlots({
	images,
	safeIndex,
	stackWidth,
	isTransitioning = () => false,
}: UsePhotoStackSlotsOptions) {
	const cardMotions = useRef(new Map<string, PhotoStackCardMotion>());
	const motionOf = useCallback(
		(image: PhotoStackImage, index: number, init?: PhotoStackSlot): PhotoStackCardMotion => {
			const key = cardMotionKey(image.src, index);
			let value = cardMotions.current.get(key);
			if (!value) {
				value = {
					x: motionValue(init?.x ?? 0),
					y: motionValue(init?.y ?? 0),
					rotate: motionValue(init?.rotate ?? 0),
					rotateY: motionValue(0),
					scale: motionValue(init?.scale ?? 1),
					opacity: motionValue(init?.opacity ?? 1),
				};
				cardMotions.current.set(key, value);
			}
			return value;
		},
		[],
	);

	const visibleCards = useMemo<PhotoStackVisibleCard[]>(() => {
		const cards: PhotoStackVisibleCard[] = [];
		const maxDepth = Math.max(safeIndex, images.length - safeIndex - 1);
		for (let depth = maxDepth; depth >= 1; depth -= 1) {
			const previousIndex = safeIndex - depth;
			if (previousIndex >= 0)
				cards.push({
					image: images[previousIndex],
					index: previousIndex,
					depth,
					axis: "left",
				});
			const nextIndex = safeIndex + depth;
			if (nextIndex < images.length)
				cards.push({ image: images[nextIndex], index: nextIndex, depth, axis: "right" });
		}
		return cards;
	}, [images, safeIndex]);

	const animateCard = useCallback(
		(card: PhotoStackVisibleCard, immediate = false) => {
			const slot = getStackSlot(card.axis, card.depth, stackWidth);
			const targetOpacity = getStackCardOpacity(card.index, safeIndex, images.length);
			const value = motionOf(card.image, card.index, { ...slot, opacity: targetOpacity });
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.rotateY.stop();
			value.scale.stop();
			value.opacity.stop();
			const alreadyThere =
				Math.abs(value.x.get() - slot.x) < 0.5 &&
				Math.abs(value.y.get() - slot.y) < 0.5 &&
				Math.abs(value.rotateY.get()) < 0.01 &&
				Math.abs(value.scale.get() - slot.scale) < 0.01 &&
				Math.abs(value.opacity.get() - targetOpacity) < 0.01;
			if (immediate || alreadyThere) {
				value.x.set(slot.x);
				value.y.set(slot.y);
				value.rotate.set(slot.rotate);
				value.rotateY.set(0);
				value.scale.set(slot.scale);
				value.opacity.set(targetOpacity);
			} else {
				animate(value.x, slot.x, SLOT_SPRING);
				animate(value.y, slot.y, SLOT_SPRING);
				animate(value.rotate, slot.rotate, SLOT_SPRING);
				animate(value.rotateY, 0, SLOT_SPRING);
				animate(value.scale, slot.scale, SLOT_SPRING);
				animate(value.opacity, targetOpacity, SLOT_SPRING);
			}
		},
		[images.length, motionOf, safeIndex, stackWidth],
	);

	useEffect(() => {
		if (!stackWidth) return;
		visibleCards.forEach((card) => {
			if (!isTransitioning(card.index)) animateCard(card);
		});
		const top = images[safeIndex];
		if (top && !isTransitioning(safeIndex)) {
			const value = motionOf(top, safeIndex, { x: 0, y: 0, rotate: 0, scale: 1 });
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.rotateY.stop();
			value.scale.stop();
			value.opacity.stop();
			animate(value.x, 0, SLOT_SPRING);
			animate(value.y, 0, SLOT_SPRING);
			animate(value.rotate, 0, SLOT_SPRING);
			animate(value.rotateY, 0, SLOT_SPRING);
			animate(value.scale, 1, SLOT_SPRING);
			animate(value.opacity, 1, SLOT_SPRING);
		}
	}, [animateCard, images, isTransitioning, motionOf, safeIndex, stackWidth, visibleCards]);
	const resetTop = useCallback(() => {
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		value.x.stop();
		value.y.stop();
		value.rotate.stop();
		value.rotateY.stop();
		value.scale.stop();
		value.opacity.stop();
		animate(value.x, 0, RESET_TWEEN);
		animate(value.y, 0, RESET_TWEEN);
		animate(value.rotate, 0, RESET_TWEEN);
		animate(value.rotateY, 0, RESET_TWEEN);
		animate(value.scale, 1, RESET_TWEEN);
		animate(value.opacity, 1, RESET_TWEEN);
	}, [images, motionOf, safeIndex]);
	const resetCards = useCallback(
		(immediate = false) => {
			visibleCards.forEach((card) => {
				if (!isTransitioning(card.index)) animateCard(card, immediate);
			});
		},
		[animateCard, isTransitioning, visibleCards],
	);
	const resetBoundary = useCallback(() => {
		const animateTo = (
			value: PhotoStackCardMotion,
			slot: PhotoStackSlot,
			targetOpacity = 1,
		) => {
			resetMotionValueVelocity(value.x);
			resetMotionValueVelocity(value.y);
			resetMotionValueVelocity(value.rotate);
			resetMotionValueVelocity(value.rotateY);
			resetMotionValueVelocity(value.scale);
			resetMotionValueVelocity(value.opacity);
			animate(value.x, slot.x, BOUNDARY_SPRING);
			animate(value.y, slot.y, BOUNDARY_SPRING);
			animate(value.rotate, slot.rotate, BOUNDARY_SPRING);
			animate(value.rotateY, 0, BOUNDARY_SPRING);
			animate(value.scale, slot.scale, BOUNDARY_SPRING);
			animate(value.opacity, targetOpacity, BOUNDARY_SPRING);
		};
		const top = images[safeIndex];
		if (top) {
			animateTo(motionOf(top, safeIndex), { x: 0, y: 0, rotate: 0, scale: 1 });
		}
		const width = stackWidth || 280;
		visibleCards.forEach((card) => {
			animateTo(
				motionOf(card.image, card.index),
				getStackSlot(card.axis, card.depth, width),
				getStackCardOpacity(card.index, safeIndex, images.length),
			);
		});
	}, [images, motionOf, safeIndex, stackWidth, visibleCards]);

	return { animateCard, motionOf, resetTop, resetCards, resetBoundary, visibleCards };
}
