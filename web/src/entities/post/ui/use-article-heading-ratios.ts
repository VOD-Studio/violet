import { type RefObject, useLayoutEffect, useMemo, useState } from "react";
import { clamp } from "./article-toc-rail-geometry";

function sameRatios(previous: number[], next: number[]) {
	return (
		previous.length === next.length &&
		previous.every((ratio, index) => Math.abs(ratio - next[index]) < 0.0001)
	);
}

/**
 * 在正文尺寸变化时测量标题相对位置，滚动期间复用结果。
 *
 * @param items - 按正文顺序排列的稳定标题列表。
 * @param contentRef - 正文容器；未挂载或缺少对应标题时使用均匀分布。
 * @returns 与标题顺序一致的 `[0, 1]` 位置比例。
 */
export function useArticleHeadingRatios(
	items: Array<{ id: string }>,
	contentRef?: RefObject<HTMLElement | null>,
) {
	const fallback = useMemo(
		() => items.map((_, index) => (items.length > 1 ? index / (items.length - 1) : 0)),
		[items],
	);
	const [ratios, setRatios] = useState(fallback);

	useLayoutEffect(() => {
		const content = contentRef?.current;
		if (!content) {
			setRatios((current) => (sameRatios(current, fallback) ? current : fallback));
			return;
		}
		let frame = 0;
		const measure = () => {
			frame = 0;
			const bounds = content.getBoundingClientRect();
			const contentHeight = content.offsetHeight || bounds.height || 1;
			const next = items.map((item, index) => {
				const heading = document.getElementById(item.id);
				if (!heading || !content.contains(heading)) return fallback[index] ?? 0;
				return clamp(
					(heading.getBoundingClientRect().top - bounds.top) / contentHeight,
					0,
					1,
				);
			});
			setRatios((current) => (sameRatios(current, next) ? current : next));
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
		observer?.observe(content);
		window.addEventListener("resize", schedule, { passive: true });
		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("resize", schedule);
		};
	}, [contentRef, fallback, items]);

	return ratios;
}
