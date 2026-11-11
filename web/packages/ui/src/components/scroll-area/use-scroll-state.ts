import { type RefObject, useEffect, useState } from "react";
import {
	EMPTY_SCROLL_METRICS,
	isSameScrollMetrics,
	readScrollMetrics,
	type ScrollMetrics,
} from "./scroll-metrics";

/** 不支持 scrollend 的浏览器里，停顿超过该时长视为滚动结束。 */
const SCROLL_IDLE_FALLBACK = 150;

export interface ScrollState {
	metrics: ScrollMetrics;
	/** 滚动正在进行；结束后滑块由 CSS 再停留 800ms 才淡出。 */
	scrolling: boolean;
}

/**
 * 跟踪原生滚动容器的位置与尺寸，不拦截滚轮、触摸或键盘滚动。
 *
 * @param viewport - 滚动容器；文档滚动传 `document.scrollingElement`
 * @param content - 随内容增减而改变尺寸的元素，用于发现不会触发 scroll 的溢出变化
 */
export function useScrollState(
	viewport: RefObject<HTMLElement | null>,
	content: RefObject<HTMLElement | null>,
): ScrollState {
	const [metrics, setMetrics] = useState(EMPTY_SCROLL_METRICS);
	const [scrolling, setScrolling] = useState(false);

	useEffect(() => {
		const element = viewport.current;
		if (!element) return;

		const isDocument = element === document.scrollingElement;
		// 文档滚动的 scroll 事件派发在 document 上，而不是 scrollingElement。
		const scrollTarget = isDocument ? document : element;
		const supportsScrollEnd = "onscrollend" in window;
		let frame = 0;
		let idleTimer: ReturnType<typeof setTimeout> | undefined;

		const measure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const next = readScrollMetrics(element);
				setMetrics((current) => (isSameScrollMetrics(current, next) ? current : next));
			});
		};

		const stopScrolling = () => {
			setScrolling(false);
		};

		const onScroll = () => {
			measure();
			setScrolling(true);

			if (!supportsScrollEnd) {
				clearTimeout(idleTimer);
				idleTimer = setTimeout(stopScrolling, SCROLL_IDLE_FALLBACK);
			}
		};

		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(element);
		if (content.current) resizeObserver.observe(content.current);

		measure();
		scrollTarget.addEventListener("scroll", onScroll, { passive: true });
		scrollTarget.addEventListener("scrollend", stopScrolling);
		// 窗口只改变高度时 html 的盒尺寸不变，ResizeObserver 观察不到文档视口的变化。
		if (isDocument) window.addEventListener("resize", measure);

		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(idleTimer);
			resizeObserver.disconnect();
			scrollTarget.removeEventListener("scroll", onScroll);
			scrollTarget.removeEventListener("scrollend", stopScrolling);
			if (isDocument) window.removeEventListener("resize", measure);
		};
	}, [viewport, content]);

	return { metrics, scrolling };
}
