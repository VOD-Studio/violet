import { type RefObject, useLayoutEffect } from "react";
import { clamp } from "./article-toc-rail-geometry";

interface TocAnchor {
	pageY: number;
	top: number;
	height: number;
}

function tocPositionAt(anchors: TocAnchor[], pageY: number, edge: "top" | "bottom"): number {
	let previous = anchors[0];
	const position = (anchor: TocAnchor) => anchor.top + (edge === "bottom" ? anchor.height : 0);
	if (pageY <= previous.pageY) return position(previous);
	for (let index = 1; index < anchors.length; index++) {
		const next = anchors[index];
		if (pageY < next.pageY) {
			const progress = (pageY - previous.pageY) / (next.pageY - previous.pageY);
			return position(previous) + (position(next) - position(previous)) * progress;
		}
		previous = next;
	}
	return position(previous);
}

interface ArticleTocIndicatorOptions {
	contentRef?: RefObject<HTMLElement | null>;
	listRef: RefObject<HTMLUListElement | null>;
	scrollRef: RefObject<HTMLDivElement | null>;
	indicatorRef: RefObject<HTMLSpanElement | null>;
	items: Array<{ id: string }>;
	isRailCollapsedAtRest: boolean;
	railActive: boolean;
	reduced: boolean;
}

/**
 * 将正文可见范围映射到目录指示线，并使列表跟随运动有限收敛。
 *
 * @remarks 尺寸仅在初始化和大小变化时读取；滚轮或触摸交互取消自动跟随，
 * 页面隐藏时停止排帧，浏览器取整造成位置不再变化时直接完成跟随。
 */
export function useArticleTocIndicator({
	contentRef,
	listRef,
	scrollRef,
	indicatorRef,
	items,
	isRailCollapsedAtRest,
	railActive,
	reduced,
}: ArticleTocIndicatorOptions) {
	useLayoutEffect(() => {
		const body = contentRef?.current;
		const list = listRef.current;
		const indicator = indicatorRef.current;
		const scroll = scrollRef.current;
		if (!body || !list || !indicator || !scroll) return;
		const listRows = list.querySelectorAll<HTMLElement>("li");
		const rows = items
			.map((item, index) => ({
				heading: body.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`),
				row: listRows[index] ?? null,
			}))
			.filter((entry): entry is { heading: HTMLElement; row: HTMLElement } =>
				Boolean(entry.heading && entry.row),
			);
		if (rows.length === 0) {
			indicator.style.opacity = "0";
			return;
		}

		let anchors: TocAnchor[] = [];
		let frame = 0;
		let followFrame = 0;
		let needsMeasure = true;
		let listTarget: number | null = null;
		let previousPosition: number | null = null;
		let height = 0;
		let maxScroll = 0;
		let shouldSnapList = !railActive;
		const followStep = () => {
			followFrame = 0;
			if (listTarget === null || document.hidden) return;
			const current = scroll.scrollTop;
			const delta = listTarget - current;
			// 检查下一帧的实际位置，兼容整数/分数像素取整，不在写入后同步读布局。
			if (Math.abs(delta) < 0.5 || current === previousPosition) {
				if (current !== listTarget) scroll.scrollTop = listTarget;
				listTarget = null;
				previousPosition = null;
				return;
			}
			previousPosition = current;
			scroll.scrollTop = current + delta * 0.16;
			followFrame = requestAnimationFrame(followStep);
		};
		const stopFollow = () => {
			listTarget = null;
			previousPosition = null;
			if (followFrame) cancelAnimationFrame(followFrame);
			followFrame = 0;
		};
		const update = () => {
			frame = 0;
			if (document.hidden) return;
			if (needsMeasure) {
				needsMeasure = false;
				const scrollY = window.scrollY;
				anchors = rows.map(({ heading, row }) => ({
					pageY: heading.getBoundingClientRect().top + scrollY,
					top: row.offsetTop,
					height: row.offsetHeight,
				}));
				height = scroll.clientHeight;
				maxScroll = Math.max(0, scroll.scrollHeight - height);
				if (listTarget !== null) listTarget = clamp(listTarget, 0, maxScroll);
			}
			// 正文标题的 scroll-margin-top 为 80px。
			const start = tocPositionAt(anchors, window.scrollY + 80, "top");
			const end = tocPositionAt(anchors, window.scrollY + window.innerHeight, "bottom");
			const current = scroll.scrollTop;
			const center = (start + end) / 2;
			const snap = shouldSnapList;
			shouldSnapList = false;
			const transform = `translateY(${start}px)`;
			const indicatorHeight = `${Math.max(0, end - start)}px`;
			if (indicator.style.transform !== transform) indicator.style.transform = transform;
			if (indicator.style.height !== indicatorHeight)
				indicator.style.height = indicatorHeight;
			if (indicator.style.opacity !== "1") indicator.style.opacity = "1";
			if (!isRailCollapsedAtRest || (!railActive && !snap)) return;
			if (maxScroll === 0) {
				stopFollow();
				if (current !== 0) scroll.scrollTop = 0;
				return;
			}
			const visibleCenter = center - current;
			if (
				visibleCenter < height * 0.3 ||
				visibleCenter > height * 0.7 ||
				current > maxScroll
			) {
				listTarget = clamp(center - height / 2, 0, maxScroll);
				previousPosition = null;
				if (snap || reduced || current === listTarget) {
					if (current !== listTarget) scroll.scrollTop = listTarget;
					stopFollow();
				} else if (!followFrame) {
					followFrame = requestAnimationFrame(followStep);
				}
			}
		};
		const schedule = () => {
			if (!frame && !document.hidden) frame = requestAnimationFrame(update);
		};
		const onResize = () => {
			needsMeasure = true;
			schedule();
		};
		const onVisibility = () => {
			if (document.hidden) {
				if (frame) cancelAnimationFrame(frame);
				frame = 0;
				stopFollow();
			} else onResize();
		};
		update();
		const observer = new ResizeObserver(onResize);
		observer.observe(body);
		observer.observe(list);
		observer.observe(scroll);
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", onResize, { passive: true });
		document.addEventListener("visibilitychange", onVisibility);
		scroll.addEventListener("wheel", stopFollow, { passive: true });
		scroll.addEventListener("touchstart", stopFollow, { passive: true });
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", onResize);
			document.removeEventListener("visibilitychange", onVisibility);
			scroll.removeEventListener("wheel", stopFollow);
			scroll.removeEventListener("touchstart", stopFollow);
			if (frame) cancelAnimationFrame(frame);
			stopFollow();
		};
	}, [
		contentRef,
		listRef,
		scrollRef,
		indicatorRef,
		items,
		isRailCollapsedAtRest,
		railActive,
		reduced,
	]);
}
