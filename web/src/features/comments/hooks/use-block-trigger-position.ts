import { type RefObject, useLayoutEffect, useState } from "react";

const TOP_OFFSET_PX = 2;
const BELOW_GAP_PX = 4;
const INLINE_GAP_PX = 6;
/** 与入口的 1.75rem 样式一致，碰撞检测包含完整按钮。 */
const ENTRY_SIZE_PX = 28;

interface BlockTriggerPosition {
	top: number;
	height: number;
	inlineLeft: number | null;
}

interface UseBlockTriggerPositionOptions {
	block: HTMLElement | null;
	layerRef: RefObject<HTMLElement | null>;
	touch: boolean;
}

/**
 * 将入口对齐正文块，触屏落点避开标记 data-annotation-occluder 的页面浮动操作组。
 *
 * @returns 相对覆盖层的坐标；inlineLeft 为 null 时沿用段落右下方的 CSS 定位。
 */
export function useBlockTriggerPosition({
	block,
	layerRef,
	touch,
}: UseBlockTriggerPositionOptions): BlockTriggerPosition {
	const [position, setPosition] = useState<BlockTriggerPosition>({
		top: 0,
		height: 0,
		inlineLeft: null,
	});
	useLayoutEffect(() => {
		const layer = layerRef.current;
		if (!block || !layer) {
			return;
		}
		let frame = 0;
		const obstacles = touch
			? document.querySelectorAll<HTMLElement>("[data-annotation-occluder]")
			: [];
		const measure = () => {
			frame = 0;
			const rect = block.getBoundingClientRect();
			const layerRect = layer.getBoundingClientRect();
			let top = rect.top + TOP_OFFSET_PX;
			let left: number | null = null;
			if (touch) {
				const range = document.createRange();
				range.selectNodeContents(block);
				const lines =
					typeof range.getClientRects === "function" ? range.getClientRects() : [];
				const last = lines[lines.length - 1];
				if (last && last.right + INLINE_GAP_PX + ENTRY_SIZE_PX <= layerRect.right) {
					top = last.top + (last.height - ENTRY_SIZE_PX) / 2;
					left = last.right + INLINE_GAP_PX;
				} else {
					top = rect.bottom + BELOW_GAP_PX;
				}
				for (const obstacle of obstacles) {
					const bounds = obstacle.getBoundingClientRect();
					const entryLeft = left ?? layerRect.right - ENTRY_SIZE_PX;
					if (
						entryLeft < bounds.right &&
						entryLeft + ENTRY_SIZE_PX > bounds.left &&
						top < bounds.bottom &&
						top + ENTRY_SIZE_PX > bounds.top
					) {
						// 横向避让后放到段落下方，不盖住原先的末行文字。
						top = rect.bottom + BELOW_GAP_PX;
						left = Math.max(
							layerRect.left,
							bounds.left - INLINE_GAP_PX - ENTRY_SIZE_PX,
						);
					}
				}
			}
			const next = {
				top: top - layerRect.top,
				height: rect.height,
				inlineLeft: left === null ? null : left - layerRect.left,
			};
			setPosition((current) =>
				current.top === next.top &&
				current.height === next.height &&
				current.inlineLeft === next.inlineLeft
					? current
					: next,
			);
		};
		const schedule = () => {
			if (!frame) {
				frame = requestAnimationFrame(measure);
			}
		};
		measure();
		const observer = new ResizeObserver(schedule);
		observer.observe(block);
		if (layer.parentElement) {
			observer.observe(layer.parentElement);
		}
		for (const obstacle of obstacles) {
			observer.observe(obstacle);
		}
		window.addEventListener("scroll", schedule, { passive: true, capture: true });
		window.addEventListener("resize", schedule);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
		};
	}, [block, layerRef, touch]);
	return position;
}
