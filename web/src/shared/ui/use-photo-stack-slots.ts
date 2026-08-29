import { animate, motionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PhotoStackImage } from "./photo-stack";
import type { PhotoStackCardMotion, PhotoStackVisibleCard } from "./photo-stack-cards";
import { getStackSlot, type PhotoStackSlot } from "./photo-stack-motion";

const SLOT_SPRING = { type: "spring", stiffness: 320, damping: 30 } as const;

export interface UsePhotoStackSlotsOptions {
	/** 媒体资源列表。 */
	images: PhotoStackImage[];
	/** 已钳制到列表范围内的当前索引。 */
	safeIndex: number;
	/** 舞台像素宽度。 */
	stackWidth: number;
}

/** 管理有限堆叠的卡片 MotionValue、可见槽位和回弹动作。 */
export function usePhotoStackSlots({ images, safeIndex, stackWidth }: UsePhotoStackSlotsOptions) {
	const cardMotions = useRef(new Map<string, PhotoStackCardMotion>());
	const motionOf = useCallback(
		(image: PhotoStackImage, index: number, init?: PhotoStackSlot): PhotoStackCardMotion => {
			const key = `${image.src}-${index}`;
			let value = cardMotions.current.get(key);
			if (!value) {
				value = {
					x: motionValue(init?.x ?? 0),
					y: motionValue(init?.y ?? 0),
					rotate: motionValue(init?.rotate ?? 0),
					scale: motionValue(init?.scale ?? 1),
				};
				cardMotions.current.set(key, value);
			}
			return value;
		},
		[],
	);

	const visibleCards = useMemo<PhotoStackVisibleCard[]>(() => {
		const cards: PhotoStackVisibleCard[] = [];
		for (let depth = 3; depth >= 1; depth -= 1) {
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
			const value = motionOf(card.image, card.index);
			const slot = getStackSlot(card.axis, card.depth, stackWidth);
			value.x.stop();
			value.y.stop();
			value.rotate.stop();
			value.scale.stop();
			if (immediate) {
				value.x.set(slot.x);
				value.y.set(slot.y);
				value.rotate.set(slot.rotate);
				value.scale.set(slot.scale);
			} else {
				animate(value.x, slot.x, SLOT_SPRING);
				animate(value.y, slot.y, SLOT_SPRING);
				animate(value.rotate, slot.rotate, SLOT_SPRING);
				animate(value.scale, slot.scale, SLOT_SPRING);
			}
		},
		[motionOf, stackWidth],
	);

	useEffect(() => {
		if (!stackWidth) return;
		visibleCards.forEach((card) => {
			animateCard(card);
		});
		const top = images[safeIndex];
		if (top) {
			const value = motionOf(top, safeIndex);
			animate(value.x, 0, SLOT_SPRING);
			animate(value.y, 0, SLOT_SPRING);
			animate(value.rotate, 0, SLOT_SPRING);
			animate(value.scale, 1, SLOT_SPRING);
		}
	}, [animateCard, images, motionOf, safeIndex, stackWidth, visibleCards]);

	const resetTop = useCallback(() => {
		const top = images[safeIndex];
		if (!top) return;
		const value = motionOf(top, safeIndex);
		animate(value.x, 0, SLOT_SPRING);
		animate(value.y, 0, SLOT_SPRING);
		animate(value.rotate, 0, SLOT_SPRING);
		animate(value.scale, 1, SLOT_SPRING);
	}, [images, motionOf, safeIndex]);
	const resetCards = useCallback(() => {
		visibleCards.forEach((card) => {
			animateCard(card);
		});
	}, [animateCard, visibleCards]);

	return { animateCard, motionOf, resetTop, resetCards, visibleCards };
}
